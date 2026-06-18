"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Proposal } from "@/types/proposal";
import ProposalForm from "@/components/proposals/ProposalForm";

export default function EditProposalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    // For drafts the GET proposal endpoint will not return them publicly,
    // so we pull from the drafts endpoint which is wallet-scoped.
    fetch(`/api/proposals/drafts?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then(async (j) => {
        if (cancelled) return;
        const found = (j.drafts || []).find((p: Proposal) => p.slug === slug);
        if (found) {
          setProposal(found);
          setLoading(false);
          return;
        }
        // Maybe it's already published — try the public endpoint
        const r2 = await fetch(`/api/proposals/${slug}`);
        const j2 = await r2.json();
        if (cancelled) return;
        if (j2.proposal) {
          setProposal(j2.proposal);
          if (j2.proposal.status !== "draft") {
            setError("Only drafts can be edited.");
          }
        } else {
          setError("Proposal not found.");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load proposal");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, slug]);

  if (!connected || !publicKey) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Edit <span className="text-daory-cyan">Draft</span>
        </h1>
        <p className="text-daory-muted text-sm mb-6">
          Connect the creator wallet to edit this proposal.
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-daory-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-red-400 text-sm mb-6">{error || "Proposal not found."}</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 border border-daory-border text-daory-muted font-bold uppercase tracking-wider text-sm hover:text-white hover:border-daory-cyan transition-colors"
        >
          Back to Proposals
        </Link>
      </div>
    );
  }

  if (proposal.creator_wallet !== publicKey.toBase58()) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Not the <span className="text-daory-cyan">Creator</span>
        </h1>
        <p className="text-daory-muted text-sm mb-6">
          Only the wallet that created this proposal can edit it.
        </p>
        <Link
          href={`/proposals/${proposal.slug}`}
          className="inline-block px-6 py-2.5 border border-daory-border text-daory-muted font-bold uppercase tracking-wider text-sm hover:text-white hover:border-daory-cyan transition-colors"
        >
          View Proposal
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
          <Link href={`/proposals/${proposal.slug}`} className="hover:text-white transition-colors">
            {proposal.slug}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white">Edit</span>
        </div>
        <h1
          className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Edit <span className="text-daory-cyan">Draft</span>
        </h1>
      </div>
      <ProposalForm initial={proposal} />
    </div>
  );
}
