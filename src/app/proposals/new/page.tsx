"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import ProposalForm from "@/components/proposals/ProposalForm";

export default function NewProposalPage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Probe authorization via drafts endpoint (returns [] for unauthorized)
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    fetch(`/api/proposals/drafts?wallet=${publicKey.toBase58()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!cancelled) setAuthorized(Array.isArray(j.drafts));
      })
      .catch(() => {
        if (!cancelled) setAuthorized(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          New <span className="text-daory-cyan">Proposal</span>
        </h1>
        <p className="text-daory-muted text-sm mb-6">
          Connect a whitelisted creator wallet to draft a new proposal.
        </p>
        <button
          onClick={() => setVisible(true)}
          className="inline-block px-6 py-2.5 border border-daory-cyan text-daory-cyan font-bold uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Not <span className="text-daory-cyan">Authorized</span>
        </h1>
        <p className="text-daory-muted text-sm mb-2">
          This wallet is not on the proposal creators whitelist.
        </p>
        <p className="text-daory-muted text-xs font-mono mb-6">
          {publicKey.toBase58()}
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 border border-daory-border text-daory-muted font-bold uppercase tracking-wider text-sm hover:text-white hover:border-daory-cyan transition-colors"
        >
          Back to Proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <div className="text-[11px] uppercase tracking-wider text-daory-muted mb-2">
          <Link href="/" className="hover:text-white transition-colors">Proposals</Link>
          <span className="mx-2">/</span>
          <span className="text-white">New</span>
        </div>
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          New <span className="text-daory-cyan">Proposal</span>
        </h1>
      </div>
      <ProposalForm />
    </div>
  );
}
