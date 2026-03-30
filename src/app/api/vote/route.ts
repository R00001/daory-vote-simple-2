import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { verifySignature } from "@/lib/verify-signature";
import { getMintOwner } from "@/lib/snapshot";
import { createAdminClient } from "@/lib/supabase";
import { candidates } from "@/lib/candidates";
import {
  MAX_COUNCILLOR_PICKS,
  MAX_ADVISOR_PICKS,
  COUNCILLOR_ROLES,
  ELECTION_START,
  ELECTION_END,
} from "@/lib/constants";
import { createBallotMessage } from "@/lib/ballot";
import { VoteRequest } from "@/types";

function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Election window check
  const now = Date.now();
  if (now < ELECTION_START.getTime()) {
    return NextResponse.json({ error: "Election has not started yet" }, { status: 403 });
  }
  if (now > ELECTION_END.getTime()) {
    return NextResponse.json({ error: "Election has ended" }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Voting not available: database not configured" },
      { status: 503 }
    );
  }

  let body: VoteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { wallet, candidateIds, mintAddresses, signature, message } = body;

  if (!wallet || !candidateIds?.length || !mintAddresses?.length || !signature || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Input length limits
  if (mintAddresses.length > 1000) {
    return NextResponse.json({ error: "Too many NFTs in a single ballot" }, { status: 400 });
  }
  if (candidateIds.length > MAX_COUNCILLOR_PICKS + MAX_ADVISOR_PICKS) {
    return NextResponse.json({ error: "Too many candidates selected" }, { status: 400 });
  }

  // Validate wallet address format
  if (!isValidPublicKey(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Validate mint address formats
  for (const mint of mintAddresses) {
    if (!isValidPublicKey(mint)) {
      return NextResponse.json({ error: `Invalid mint address: ${mint.slice(0, 8)}...` }, { status: 400 });
    }
  }

  // Validate all candidates exist
  for (const id of candidateIds) {
    if (!candidates.find((c) => c.id === id)) {
      return NextResponse.json({ error: `Invalid candidate: ${id}` }, { status: 400 });
    }
  }

  // Check for duplicates in candidateIds
  if (new Set(candidateIds).size !== candidateIds.length) {
    return NextResponse.json({ error: "Duplicate candidate in ballot" }, { status: 400 });
  }

  // Validate councillor/advisor limits
  const councillorPicks = candidateIds.filter((id) => {
    const c = candidates.find((c) => c.id === id);
    return c && (COUNCILLOR_ROLES as readonly string[]).includes(c.role);
  });
  const advisorPicks = candidateIds.filter((id) => {
    const c = candidates.find((c) => c.id === id);
    return c && c.role === "Advisor";
  });

  if (councillorPicks.length > MAX_COUNCILLOR_PICKS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_COUNCILLOR_PICKS} councillor picks allowed` },
      { status: 400 }
    );
  }
  if (advisorPicks.length > MAX_ADVISOR_PICKS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ADVISOR_PICKS} advisor picks allowed` },
      { status: 400 }
    );
  }

  // Verify signature
  const isValid = verifySignature(message, signature, wallet);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Verify message content
  const timestamp = message
    .split("\n")
    .find((l: string) => l.startsWith("Timestamp:"))
    ?.replace("Timestamp: ", "");
  if (!timestamp) {
    return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
  }

  const expectedMessage = createBallotMessage(candidateIds, mintAddresses, timestamp);
  if (message !== expectedMessage) {
    return NextResponse.json({ error: "Message content mismatch" }, { status: 400 });
  }

  // Check message freshness (5 min)
  if (Math.abs(Date.now() - new Date(timestamp).getTime()) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Message expired, please try again" }, { status: 400 });
  }

  // Check for delegation
  let aurorian_wallet = wallet;
  const { data: delegation } = await supabase
    .from("wallet_delegations")
    .select("aurorian_wallet")
    .eq("voting_wallet", wallet)
    .eq("verified", true)
    .single();

  if (delegation) {
    aurorian_wallet = delegation.aurorian_wallet;
  }

  // Verify each mint belongs to the aurorian wallet
  for (const mint of mintAddresses) {
    const owner = getMintOwner(mint);
    if (owner !== aurorian_wallet) {
      return NextResponse.json(
        { error: "One or more NFTs do not belong to this wallet in the snapshot" },
        { status: 403 }
      );
    }
  }

  // Atomic ballot submission via DB function (prevents race conditions)
  const { data, error } = await supabase.rpc("submit_ballot", {
    p_nft_mints: mintAddresses,
    p_voter_wallet: wallet,
    p_signature: signature,
    p_candidate_ids: candidateIds,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to record ballot" }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string; votes_recorded?: number };

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "One or more NFTs have already submitted a ballot" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    votesRecorded: result.votes_recorded,
    nftsUsed: mintAddresses.length,
    candidatesVoted: candidateIds.length,
  });
}
