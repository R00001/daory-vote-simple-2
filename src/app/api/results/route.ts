import { NextResponse } from "next/server";
import { createReadClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createReadClient();

  if (!supabase) {
    // No DB configured - signal to frontend to show demo
    return NextResponse.json({ tallies: [], totalVotes: 0, uniqueVoters: 0, showResults: true, noDb: true });
  }

  // Check if results should be shown
  const { data: settings } = await supabase
    .from("election_settings")
    .select("show_results")
    .eq("id", 1)
    .single();

  const showResults = settings?.show_results ?? false;

  // Always return basic participation stats (even when results hidden)
  const { count: totalVotes } = await supabase
    .from("ballots")
    .select("*", { count: "exact", head: true });

  const { data: voterData } = await supabase
    .from("ballots")
    .select("voter_wallet")
    .limit(10000);

  const uniqueVoters = voterData
    ? new Set(voterData.map((v) => v.voter_wallet)).size
    : 0;

  // If results are hidden, return only participation stats
  if (!showResults) {
    return NextResponse.json({
      showResults: false,
      totalVotes: totalVotes || 0,
      uniqueVoters,
      tallies: [],
    });
  }

  // Results are visible - return full tallies
  const { data: tallies, error } = await supabase
    .from("vote_tallies")
    .select("candidate_id, vote_count");

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    showResults: true,
    tallies: tallies || [],
    totalVotes: totalVotes || 0,
    uniqueVoters,
  });
}
