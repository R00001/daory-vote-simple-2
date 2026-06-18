import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createAdminClient } from "@/lib/supabase";
import { verifySignature } from "@/lib/verify-signature";
import { getMintOwner } from "@/lib/snapshot";
import { createProposalVoteMessage } from "@/lib/proposal-message";
import { Proposal } from "@/types/proposal";

export const dynamic = "force-dynamic";

function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Voting not available: database not configured" },
      { status: 503 }
    );
  }

  let body: {
    wallet?: string;
    optionIds?: string[];
    mintAddresses?: string[];
    signature?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { wallet, optionIds, mintAddresses, signature, message } = body;
  if (!wallet || !optionIds?.length || !mintAddresses?.length || !signature || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidPublicKey(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (mintAddresses.length > 1000) {
    return NextResponse.json({ error: "Too many NFTs in a single ballot" }, { status: 400 });
  }
  for (const mint of mintAddresses) {
    if (!isValidPublicKey(mint)) {
      return NextResponse.json(
        { error: `Invalid mint address: ${mint.slice(0, 8)}...` },
        { status: 400 }
      );
    }
  }

  // Lookup proposal
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data: proposalRow } = await supabase
    .from("proposals")
    .select("*")
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();
  const proposal = proposalRow as Proposal | null;
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status === "draft" || proposal.status === "cancelled") {
    return NextResponse.json(
      { error: `Proposal is ${proposal.status}` },
      { status: 403 }
    );
  }

  const now = Date.now();
  if (now < new Date(proposal.starts_at).getTime()) {
    return NextResponse.json({ error: "Voting has not started yet" }, { status: 403 });
  }
  if (now > new Date(proposal.ends_at).getTime()) {
    return NextResponse.json({ error: "Voting has ended" }, { status: 403 });
  }

  // Validate options against proposal definition
  const validIds = new Set(proposal.options.map((o) => o.id));
  for (const o of optionIds) {
    if (!validIds.has(o)) {
      return NextResponse.json({ error: `Invalid option: ${o}` }, { status: 400 });
    }
  }
  if (new Set(optionIds).size !== optionIds.length) {
    return NextResponse.json({ error: "Duplicate option in ballot" }, { status: 400 });
  }
  if (proposal.type === "single_choice") {
    if (optionIds.length !== 1) {
      return NextResponse.json(
        { error: "This vote requires exactly one selection" },
        { status: 400 }
      );
    }
  } else if (proposal.type === "multi_choice") {
    if (proposal.max_choices && optionIds.length > proposal.max_choices) {
      return NextResponse.json(
        { error: `Maximum ${proposal.max_choices} selections allowed` },
        { status: 400 }
      );
    }
    if (optionIds.length < 1) {
      return NextResponse.json({ error: "Select at least one option" }, { status: 400 });
    }
  }

  // Verify signed message
  const ts = message
    .split("\n")
    .find((l) => l.startsWith("Timestamp:"))
    ?.replace("Timestamp: ", "");
  if (!ts) return NextResponse.json({ error: "Bad message format" }, { status: 400 });
  const expected = createProposalVoteMessage(proposal.slug, optionIds, mintAddresses, ts);
  if (message !== expected) {
    return NextResponse.json({ error: "Message content mismatch" }, { status: 400 });
  }
  if (Math.abs(Date.now() - new Date(ts).getTime()) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Message expired, please re-sign" }, { status: 400 });
  }
  if (!verifySignature(message, signature, wallet)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Resolve aurorian wallet through delegation
  let aurorian_wallet = wallet;
  const { data: delegation } = await supabase
    .from("wallet_delegations")
    .select("aurorian_wallet")
    .eq("voting_wallet", wallet)
    .eq("verified", true)
    .single();
  if (delegation) aurorian_wallet = delegation.aurorian_wallet;

  for (const mint of mintAddresses) {
    const owner = getMintOwner(mint);
    if (owner !== aurorian_wallet) {
      return NextResponse.json(
        { error: "One or more NFTs do not belong to this wallet in the snapshot" },
        { status: 403 }
      );
    }
  }

  // Submit via atomic RPC
  const { data, error } = await supabase.rpc("submit_proposal_ballot", {
    p_proposal_id: proposal.id,
    p_nft_mints: mintAddresses,
    p_voter_wallet: wallet,
    p_signature: signature,
    p_option_ids: optionIds,
    p_allow_change: proposal.allow_vote_change,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to record ballot", details: error.message },
      { status: 500 }
    );
  }

  const result = data as { success: boolean; error?: string; votes_recorded?: number };
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Vote rejected" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    votesRecorded: result.votes_recorded,
    nftsUsed: mintAddresses.length,
  });
}
