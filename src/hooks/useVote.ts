"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createBallotMessage } from "@/lib/ballot";
import bs58 from "bs58";

export function useVote() {
  const { publicKey, signMessage } = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = async (
    candidateIds: string[],
    mintAddresses: string[]
  ): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support message signing");
      return false;
    }

    setSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const message = createBallotMessage(candidateIds, mintAddresses, timestamp);

      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          candidateIds,
          mintAddresses,
          signature,
          message,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to submit ballot");
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { vote, submitting, error };
}
