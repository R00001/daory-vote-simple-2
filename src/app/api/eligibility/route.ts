import { NextRequest, NextResponse } from "next/server";
import { getMintsForOwner } from "@/lib/snapshot";
import { getAuroriansForMints } from "@/lib/helius";
import { createReadClient } from "@/lib/supabase";
import { AurorianNft } from "@/types";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "wallet parameter required" },
      { status: 400 }
    );
  }

  // Also check delegated wallets
  const supabase = createReadClient();
  let aurorian_wallet = wallet;

  if (supabase) {
    const { data: delegation } = await supabase
      .from("wallet_delegations")
      .select("aurorian_wallet")
      .eq("voting_wallet", wallet)
      .eq("verified", true)
      .single();

    if (delegation) {
      aurorian_wallet = delegation.aurorian_wallet;
    }
  }

  // Check snapshot
  const mints = getMintsForOwner(aurorian_wallet);

  if (mints.length === 0) {
    return NextResponse.json({ eligible: false, aurorians: [] });
  }

  // Get Aurorian metadata from Helius
  let metadata = new Map<string, { number: number; imageUrl: string }>();
  try {
    metadata = await getAuroriansForMints(mints);
  } catch {
    // If Helius is not configured, generate placeholder metadata from mint position
    // The user will still see their NFTs, just without proper numbers
  }

  // Check which mints have already submitted a ballot
  // Batch in chunks of 100 to avoid PostgREST URL length limits
  const votedMints = new Set<string>();
  if (supabase) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
      const batch = mints.slice(i, i + BATCH_SIZE);
      const { data: existingBallots } = await supabase
        .from("ballots")
        .select("nft_mint")
        .in("nft_mint", batch);

      if (existingBallots) {
        for (const b of existingBallots) {
          votedMints.add(b.nft_mint);
        }
      }
    }
  }

  // Build response
  const hasMetadata = metadata.size > 0;
  const aurorians: AurorianNft[] = mints.map((mint, i) => {
    const meta = metadata.get(mint);
    return {
      mint,
      number: meta?.number ?? 0,
      imageUrl: meta?.imageUrl ?? "",
      hasVoted: votedMints.has(mint),
      hasMetadata,
    };
  });

  aurorians.sort((a, b) => a.number - b.number);

  return NextResponse.json({
    eligible: true,
    aurorians,
    delegatedFrom: aurorian_wallet !== wallet ? aurorian_wallet : undefined,
  });
}
