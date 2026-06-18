"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "form" | "pending" | "verify" | "done";

interface DelegationData {
  verificationLamports: number;
  verificationSol: number;
  fromWallet: string;
  toWallet: string;
}

export default function DelegateWallet() {
  const [step, setStep] = useState<Step>("form");
  const [aurorianWallet, setAurorianWallet] = useState("");
  const [votingWallet, setVotingWallet] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [delegation, setDelegation] = useState<DelegationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!aurorianWallet || !votingWallet) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/delegate/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aurorianWallet, votingWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDelegation({
        verificationLamports: data.verificationLamports,
        verificationSol: data.verificationSol,
        fromWallet: data.fromWallet,
        toWallet: data.toWallet,
      });
      setStep("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!txSignature) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/delegate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aurorianWallet, txSignature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-daory-card border border-daory-border p-4 sm:p-6 max-w-lg">
      <h2
        className="text-xl font-bold text-white uppercase mb-1"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Designate <span className="text-daory-cyan">Voting Wallet</span>
      </h2>
      <p className="text-sm text-daory-muted mb-6">
        Vote from a separate wallet. Your Aurorian wallet never connects to this
        site &mdash; you prove ownership with a micro SOL transfer instead.
      </p>

      {error && (
        <div className="border border-red-800/50 bg-red-900/10 p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step 1: Enter both wallets */}
      {step === "form" && (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">
              Your Aurorian Wallet (holder - NOT connected)
            </label>
            <input
              type="text"
              value={aurorianWallet}
              onChange={(e) => setAurorianWallet(e.target.value)}
              placeholder="Paste your Aurorian holder wallet address"
              className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/50 focus:border-daory-cyan focus:outline-none transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">
              Voting Wallet (will connect to vote)
            </label>
            <input
              type="text"
              value={votingWallet}
              onChange={(e) => setVotingWallet(e.target.value)}
              placeholder="Paste the wallet you'll connect to vote"
              className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/50 focus:border-daory-cyan focus:outline-none transition-colors font-mono"
            />
          </div>

          <div className="bg-white/[0.02] border border-daory-border p-3">
            <p className="text-xs text-daory-muted leading-relaxed">
              <strong className="text-white">Your Aurorian wallet stays safe.</strong>{" "}
              We&apos;ll generate a unique micro-SOL amount. You send it from
              your Aurorian wallet to your voting wallet using your own wallet
              app (Phantom, Solflare, etc). This proves you own both wallets
              without ever connecting the holder wallet here.
            </p>
          </div>

          <button
            onClick={handleRequest}
            disabled={loading || !aurorianWallet || !votingWallet}
            className="w-full px-4 py-2.5 border border-daory-cyan text-daory-cyan font-medium uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Generate Verification Amount"}
          </button>
        </div>
      )}

      {/* Step 2: Show verification amount */}
      {step === "pending" && delegation && (
        <div className="space-y-4">
          <div className="bg-white/[0.02] border border-daory-cyan/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-3">
              Send this exact amount
            </p>
            <p className="text-lg sm:text-2xl font-bold text-daory-cyan font-mono tracking-wide">
              {delegation.verificationSol.toFixed(10)} SOL
            </p>
            <p className="text-[10px] text-daory-muted mt-1">
              ({delegation.verificationLamports.toLocaleString()} lamports)
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-daory-muted">From (your holder wallet)</span>
              <span className="text-white font-mono text-xs">
                {delegation.fromWallet.slice(0, 8)}...
                {delegation.fromWallet.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-daory-muted">To (your voting wallet)</span>
              <span className="text-white font-mono text-xs">
                {delegation.toWallet.slice(0, 8)}...
                {delegation.toWallet.slice(-8)}
              </span>
            </div>
          </div>

          <div className="bg-amber-900/10 border border-amber-700/30 p-3">
            <p className="text-xs text-amber-300 leading-relaxed">
              Open your wallet app (Phantom, Solflare, etc.), send exactly this
              amount from your Aurorian wallet to your voting wallet. Then come
              back and paste the transaction signature.
            </p>
          </div>

          <button
            onClick={() => setStep("verify")}
            className="w-full px-4 py-2.5 border border-daory-cyan text-daory-cyan font-medium uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
          >
            I&apos;ve sent it &mdash; Enter TX Signature
          </button>

          <button
            onClick={() => { setStep("form"); setDelegation(null); }}
            className="w-full px-4 py-2 text-daory-muted text-xs hover:text-white transition-colors"
          >
            Start over
          </button>
        </div>
      )}

      {/* Step 3: Enter TX signature */}
      {step === "verify" && (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">
              Transaction Signature
            </label>
            <input
              type="text"
              value={txSignature}
              onChange={(e) => setTxSignature(e.target.value)}
              placeholder="Paste the transaction signature here"
              className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/50 focus:border-daory-cyan focus:outline-none transition-colors font-mono"
            />
            <p className="text-xs text-daory-muted mt-1">
              Find this in your wallet&apos;s transaction history or on Solscan.
            </p>
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || !txSignature}
            className="w-full px-4 py-2.5 bg-daory-cyan text-black font-bold uppercase tracking-wider text-sm hover:bg-daory-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying on-chain..." : "Verify Transaction"}
          </button>

          <button
            onClick={() => setStep("pending")}
            className="w-full px-4 py-2 text-daory-muted text-xs hover:text-white transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-daory-cyan flex items-center justify-center">
            <svg className="w-6 h-6 text-daory-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-bold text-white mb-2">Delegation Verified!</p>
          <p className="text-sm text-daory-muted mb-4">
            Now connect your <strong className="text-white">voting wallet</strong> on
            the Vote page to cast your ballot.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 border border-daory-cyan text-daory-cyan font-medium uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
          >
            Go to Proposals
          </Link>
        </div>
      )}
    </div>
  );
}
