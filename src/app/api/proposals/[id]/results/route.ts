import { NextRequest, NextResponse } from "next/server";
import { createReadClient } from "@/lib/supabase";
import { shouldRevealResults } from "@/lib/proposals";
import { Proposal, ProposalTally } from "@/types/proposal";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createReadClient();
  if (!supabase) {
    return NextResponse.json({
      proposal: null,
      tallies: [] as ProposalTally[],
      uniqueBallots: 0,
      revealed: true,
    });
  }

  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data: proposalRow } = await supabase
    .from("proposals")
    .select("*")
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();
  const proposal = proposalRow as Proposal | null;
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Always return participation count.
  const { count: uniqueBallots } = await supabase
    .from("proposal_ballots")
    .select("*", { count: "exact", head: true })
    .eq("proposal_id", proposal.id);

  const revealed = shouldRevealResults(proposal);

  if (!revealed) {
    return NextResponse.json({
      proposal,
      tallies: [],
      uniqueBallots: uniqueBallots || 0,
      revealed: false,
    });
  }

  const { data: tallies } = await supabase
    .from("proposal_tallies")
    .select("option_id, vote_count, unique_voters")
    .eq("proposal_id", proposal.id);

  return NextResponse.json({
    proposal,
    tallies: (tallies ?? []) as ProposalTally[],
    uniqueBallots: uniqueBallots || 0,
    revealed: true,
  });
}
