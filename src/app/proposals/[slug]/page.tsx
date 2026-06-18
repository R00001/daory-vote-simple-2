"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Proposal, ProposalTally } from "@/types/proposal";
import {
  CATEGORY_STYLE,
  STATUS_STYLE,
  effectiveStatus,
  formatCountdown,
} from "@/lib/proposals";
import RichTextView from "@/components/proposals/RichTextView";
import ProposalVoter from "@/components/proposals/ProposalVoter";
import ProposalResults from "@/components/proposals/ProposalResults";

const TYPE_LABEL: Record<Proposal["type"], string> = {
  single_choice: "Pick One",
  multi_choice: "Pick Multiple",
};

export default function ProposalDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { publicKey } = useWallet();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [tallies, setTallies] = useState<ProposalTally[]>([]);
  const [uniqueBallots, setUniqueBallots] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [votedMints, setVotedMints] = useState<string[]>([]);
  const [votedOptionIds, setVotedOptionIds] = useState<string[]>([]);

  const fetchProposal = useCallback(async () => {
    const res = await fetch(`/api/proposals/${slug}/results`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const json = await res.json();
    setProposal(json.proposal);
    setTallies(json.tallies || []);
    setUniqueBallots(json.uniqueBallots || 0);
    setRevealed(json.revealed);
  }, [slug]);

  const fetchMyVote = useCallback(async () => {
    if (!publicKey) {
      setVotedMints([]);
      setVotedOptionIds([]);
      return;
    }
    const res = await fetch(`/api/proposals/${slug}/my-vote?wallet=${publicKey.toBase58()}`);
    if (res.ok) {
      const json = await res.json();
      setVotedMints(json.votedMints || []);
      setVotedOptionIds(json.votedOptionIds || []);
    }
  }, [publicKey, slug]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await fetchProposal();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const t = setInterval(fetchProposal, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fetchProposal]);

  useEffect(() => {
    fetchMyVote();
  }, [fetchMyVote]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-daory-muted text-sm">Loading proposal…</p>
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1
          className="text-2xl sm:text-4xl font-bold text-white uppercase mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Proposal <span className="text-daory-cyan">Not Found</span>
        </h1>
        <p className="text-daory-muted text-sm mb-6">
          The proposal you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 border border-daory-cyan text-daory-cyan font-bold uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
        >
          Back to Proposals
        </Link>
      </div>
    );
  }

  const status = effectiveStatus(proposal);
  const statusStyle = STATUS_STYLE[status];
  const catStyle = CATEGORY_STYLE[proposal.category] ?? CATEGORY_STYLE.Other;
  const isCreator = publicKey?.toBase58() === proposal.creator_wallet;
  const timeLabel =
    status === "active"
      ? `Ends in ${formatCountdown(proposal.ends_at)}`
      : status === "scheduled"
      ? `Starts in ${formatCountdown(proposal.starts_at)}`
      : status === "ended"
      ? `Ended ${formatCountdown(proposal.ends_at)}`
      : "";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Breadcrumb */}
      <div className="mb-4 text-[11px] uppercase tracking-wider text-daory-muted">
        <Link href="/" className="hover:text-white transition-colors">Proposals</Link>
        <span className="mx-2">/</span>
        <span className="text-white">{proposal.slug}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${catStyle.chip}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-sm align-middle mr-1.5 ${catStyle.dot}`} />
            {proposal.category}
          </span>
          <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${statusStyle.chip}`}>
            {statusStyle.label}
          </span>
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-white/[0.05] text-daory-muted border border-daory-border">
            {TYPE_LABEL[proposal.type]}
          </span>
          {proposal.binding && (
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-daory-cyan/10 text-daory-cyan border border-daory-cyan/30">
              Binding
            </span>
          )}
          {timeLabel && (
            <span className={`ml-auto text-[11px] uppercase tracking-wider ${
              status === "active" ? "text-daory-cyan font-bold" : "text-daory-muted"
            }`}>
              {timeLabel}
            </span>
          )}
        </div>

        <h1
          className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white uppercase tracking-tight mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {proposal.title}
        </h1>
        {proposal.summary && (
          <p className="text-base text-daory-muted leading-relaxed max-w-3xl">
            {proposal.summary}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] uppercase tracking-wider text-daory-muted">
          <span>
            By{" "}
            <span className="text-white font-mono normal-case">
              {proposal.creator_wallet.slice(0, 6)}…{proposal.creator_wallet.slice(-6)}
            </span>
          </span>
          <span>&middot;</span>
          <span>
            {new Date(proposal.starts_at).toLocaleString()} →{" "}
            {new Date(proposal.ends_at).toLocaleString()}
          </span>
          {proposal.discussion_url && (
            <>
              <span>&middot;</span>
              <a
                href={proposal.discussion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-daory-cyan hover:underline normal-case tracking-normal"
              >
                Discussion ↗
              </a>
            </>
          )}
        </div>
      </div>

      {/* Cancellation banner */}
      {status === "cancelled" && (
        <div className="mb-6 border border-red-800/50 bg-red-900/10 p-4">
          <p className="text-red-400 font-bold uppercase tracking-wider text-xs mb-1">Cancelled</p>
          {proposal.cancelled_reason && (
            <p className="text-red-300 text-sm">{proposal.cancelled_reason}</p>
          )}
        </div>
      )}

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
        {/* Left: description */}
        <div className="bg-daory-card border border-daory-border p-5 sm:p-7">
          <RichTextView html={proposal.description} />
        </div>

        {/* Right: voting + results */}
        <div className="space-y-6">
          <ProposalVoter
            proposal={proposal}
            votedMints={votedMints}
            votedOptionIds={votedOptionIds}
            onVoted={() => {
              fetchProposal();
              fetchMyVote();
            }}
          />
          <ProposalResults
            proposal={proposal}
            tallies={tallies}
            uniqueBallots={uniqueBallots}
            revealed={revealed}
          />
          {isCreator && status !== "ended" && status !== "cancelled" && (
            <CreatorActions proposal={proposal} onChange={fetchProposal} />
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorActions({
  proposal,
  onChange,
}: {
  proposal: Proposal;
  onChange: () => void;
}) {
  const { publicKey, signMessage } = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doAction = async (action: "publish" | "cancel", reason?: string) => {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setErr(null);
    try {
      const ts = new Date().toISOString();
      const { hashPayload, createProposalAuthorMessage } = await import("@/lib/proposal-message");
      const hash = hashPayload({ id: proposal.id, action });
      const message = createProposalAuthorMessage(action, hash, ts);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const bs58 = (await import("bs58")).default;
      const signature = bs58.encode(sigBytes);

      const res = await fetch(`/api/proposals/${proposal.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          cancelled_reason: reason,
          wallet: publicKey.toBase58(),
          signature,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${action} failed`);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
      <h3
        className="text-sm font-bold text-white uppercase mb-3"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Creator <span className="text-daory-cyan">Actions</span>
      </h3>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      <div className="flex flex-col gap-2">
        {proposal.status === "draft" && (
          <button
            disabled={busy}
            onClick={() => doAction("publish")}
            className="w-full px-4 py-2.5 bg-daory-cyan text-black font-bold uppercase tracking-wider text-xs hover:bg-daory-cyan-dark transition-colors disabled:opacity-50"
          >
            {busy ? "Signing…" : "Publish"}
          </button>
        )}
        <a
          href={`/proposals/${proposal.slug}/edit`}
          className={`w-full text-center px-4 py-2.5 border border-daory-border text-daory-muted hover:text-white hover:border-daory-cyan font-bold uppercase tracking-wider text-xs transition-colors ${
            proposal.status !== "draft" ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
          }`}
        >
          Edit (drafts only)
        </a>
        <button
          disabled={busy}
          onClick={() => {
            const reason = window.prompt("Reason for cancellation (optional)") ?? undefined;
            doAction("cancel", reason);
          }}
          className="w-full px-4 py-2.5 border border-red-800/50 text-red-400 hover:bg-red-900/10 font-bold uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
        >
          Cancel Proposal
        </button>
      </div>
    </div>
  );
}
