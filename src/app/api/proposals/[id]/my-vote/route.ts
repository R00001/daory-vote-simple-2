import { NextRequest, NextResponse } from "next/server";
import { createReadClient } from "@/lib/supabase";
import { getMintsForOwner } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

/**
 * Returns, for a given (proposal, wallet), the list of mints owned by the
 * wallet (or its delegate) that already cast a ballot on this proposal,
 * plus the option(s) they voted for. Used by the proposal page to disable
 * already-used NFTs and surface "you already voted" UI.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const supabase = createReadClient();
  if (!supabase) {
    return NextResponse.json({ votedMints: [], votedOptions: {}, votedOptionIds: [] });
  }

  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id")
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve through delegation
  let aurorianWallet = wallet;
  const { data: delegation } = await supabase
    .from("wallet_delegations")
    .select("aurorian_wallet")
    .eq("voting_wallet", wallet)
    .eq("verified", true)
    .single();
  if (delegation) aurorianWallet = delegation.aurorian_wallet;

  const mints = getMintsForOwner(aurorianWallet);
  if (mints.length === 0) {
    return NextResponse.json({ votedMints: [], votedOptions: {}, votedOptionIds: [] });
  }

  // Batch in chunks of 100 to avoid URL length limits
  const BATCH = 100;
  const votedMints: string[] = [];
  const optionsByMint: Record<string, string[]> = {};
  const allOptionIds = new Set<string>();

  for (let i = 0; i < mints.length; i += BATCH) {
    const batch = mints.slice(i, i + BATCH);
    const { data: rows } = await supabase
      .from("proposal_votes")
      .select("nft_mint, option_id")
      .eq("proposal_id", proposal.id)
      .in("nft_mint", batch);
    if (rows) {
      for (const r of rows) {
        if (!optionsByMint[r.nft_mint]) {
          optionsByMint[r.nft_mint] = [];
          votedMints.push(r.nft_mint);
        }
        optionsByMint[r.nft_mint].push(r.option_id);
        allOptionIds.add(r.option_id);
      }
    }
  }

  return NextResponse.json({
    votedMints,
    votedOptions: optionsByMint,
    votedOptionIds: Array.from(allOptionIds),
  });
}
