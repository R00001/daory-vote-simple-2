import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createAdminClient } from "@/lib/supabase";
import { Connection } from "@solana/web3.js";

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

  let body: { aurorianWallet: string; txSignature: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { aurorianWallet, txSignature } = body;

  if (!aurorianWallet || !txSignature) {
    return NextResponse.json(
      { error: "aurorianWallet and txSignature are required" },
      { status: 400 }
    );
  }

  if (!isValidPublicKey(aurorianWallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Check TX signature not already used (prevent replay)
  const { data: existingTx } = await supabase
    .from("wallet_delegations")
    .select("id")
    .eq("tx_signature", txSignature)
    .single();

  if (existingTx) {
    return NextResponse.json(
      { error: "This transaction has already been used for verification" },
      { status: 409 }
    );
  }

  // Get the pending delegation
  const { data: delegation } = await supabase
    .from("wallet_delegations")
    .select("*")
    .eq("aurorian_wallet", aurorianWallet)
    .eq("verified", false)
    .single();

  if (!delegation) {
    return NextResponse.json(
      { error: "No pending delegation found for this wallet" },
      { status: 404 }
    );
  }

  // Verify the transaction on-chain
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  let tx;
  try {
    tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch transaction. Check the signature." },
      { status: 400 }
    );
  }

  if (!tx) {
    return NextResponse.json(
      { error: "Transaction not found. It may not be confirmed yet." },
      { status: 404 }
    );
  }

  if (tx.meta?.err) {
    return NextResponse.json(
      { error: "Transaction failed on-chain" },
      { status: 400 }
    );
  }

  // Check transaction age (must be within last 1 hour)
  const txTime = (tx.blockTime ?? 0) * 1000;
  if (Date.now() - txTime > 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Transaction is too old. Please send a new transfer." },
      { status: 400 }
    );
  }

  // Verify sender = aurorian wallet
  const accountKeys = tx.transaction.message.getAccountKeys();
  const senderKey = accountKeys.get(0)?.toBase58();

  if (senderKey !== delegation.aurorian_wallet) {
    return NextResponse.json(
      { error: "Transaction sender does not match the Aurorian wallet on file" },
      { status: 400 }
    );
  }

  // Verify recipient = voting wallet and exact amount
  const preBalances = tx.meta?.preBalances || [];
  const postBalances = tx.meta?.postBalances || [];
  const expectedLamports = Number(delegation.verification_lamports);
  const tolerance = 1; // 1 lamport tolerance

  let recipientFound = false;
  for (let i = 1; i < accountKeys.length; i++) {
    const key = accountKeys.get(i)?.toBase58();
    if (key === delegation.voting_wallet) {
      const received = (postBalances[i] ?? 0) - (preBalances[i] ?? 0);
      if (Math.abs(received - expectedLamports) <= tolerance) {
        recipientFound = true;
        break;
      }
    }
  }

  if (!recipientFound) {
    return NextResponse.json(
      {
        error: "Could not verify the transfer amount or recipient. Check the amount and recipient address.",
      },
      { status: 400 }
    );
  }

  // Mark as verified (tx_signature UNIQUE constraint prevents replay)
  const { error } = await supabase
    .from("wallet_delegations")
    .update({
      verified: true,
      tx_signature: txSignature,
      verified_at: new Date().toISOString(),
    })
    .eq("id", delegation.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This transaction has already been used" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update delegation" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Wallet delegation verified! You can now vote with your voting wallet.",
  });
}
