import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createAdminClient } from "@/lib/supabase";
import { isEligibleWallet } from "@/lib/snapshot";

function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { aurorianWallet: string; votingWallet: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { aurorianWallet, votingWallet } = body;

  if (!aurorianWallet || !votingWallet) {
    return NextResponse.json(
      { error: "aurorianWallet and votingWallet are required" },
      { status: 400 }
    );
  }

  if (!isValidPublicKey(aurorianWallet) || !isValidPublicKey(votingWallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  if (aurorianWallet === votingWallet) {
    return NextResponse.json(
      { error: "Voting wallet must be different from Aurorian wallet" },
      { status: 400 }
    );
  }

  // Verify the aurorian wallet is in the snapshot
  if (!isEligibleWallet(aurorianWallet)) {
    return NextResponse.json(
      { error: "Aurorian wallet not found in the holder snapshot" },
      { status: 404 }
    );
  }

  // Check if this aurorian wallet already has a delegation
  const { data: existing } = await supabase
    .from("wallet_delegations")
    .select("id, verified, voting_wallet, created_at, updated_at")
    .eq("aurorian_wallet", aurorianWallet)
    .single();

  if (existing?.verified) {
    return NextResponse.json(
      { error: "This Aurorian wallet already has a verified delegation" },
      { status: 409 }
    );
  }

  // Anti-griefing: if a pending request exists from a DIFFERENT voting wallet,
  // only allow overwrite after 15 minutes (gives original requester time to complete)
  if (existing && existing.voting_wallet !== votingWallet) {
    const lastActivity = new Date(existing.updated_at ?? existing.created_at).getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - lastActivity < fifteenMinutes) {
      return NextResponse.json(
        { error: "A delegation request is already pending for this wallet. Try again later." },
        { status: 429 }
      );
    }
  }

  // Generate unique verification amount in lamports (high entropy)
  const crypto = await import("crypto");
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  // Range: 1000 - 99999 lamports = 0.000001 - 0.000099 SOL (always 4+ leading zeros)
  const verificationLamports = 1000 + (randomNum % 99000);

  // Upsert the delegation request
  if (existing) {
    await supabase
      .from("wallet_delegations")
      .update({
        voting_wallet: votingWallet,
        verification_lamports: verificationLamports,
        verified: false,
        tx_signature: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("wallet_delegations").insert({
      aurorian_wallet: aurorianWallet,
      voting_wallet: votingWallet,
      verification_lamports: verificationLamports,
      verified: false,
    });
  }

  const verificationSol = verificationLamports / 1_000_000_000;

  return NextResponse.json({
    success: true,
    verificationLamports,
    verificationSol,
    fromWallet: aurorianWallet,
    toWallet: votingWallet,
  });
}
