"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Proposal } from "@/types/proposal";
import { effectiveStatus, formatCountdown } from "@/lib/proposals";
import {
  ELECTION_START,
  ELECTION_END,
  TOTAL_SNAPSHOT_NFTS,
} from "@/lib/constants";
import ProposalCard, { SpecialVoteCard } from "@/components/proposals/ProposalCard";

type Tab = "active" | "scheduled" | "ended" | "all";

export default function HomePage() {
  const { publicKey } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [drafts, setDrafts] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");
  const [isCreator, setIsCreator] = useState(false);

  // Fetch proposals
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/proposals");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setProposals(json.proposals || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Fetch drafts if wallet is connected (drafts API checks whitelist)
  useEffect(() => {
    if (!publicKey) {
      setDrafts([]);
      setIsCreator(false);
      return;
    }
    const wallet = publicKey.toBase58();
    fetch(`/api/proposals/drafts?wallet=${wallet}`)
      .then((r) => r.json())
      .then((j) => {
        setDrafts(j.drafts || []);
        // If the API returns drafts (even an empty array vs nothing) we don't
        // know creator status with certainty; the API only returns drafts for
        // creators, so a 200 + array means whitelisted. The presence of any
        // draft also confirms it.
        setIsCreator(Array.isArray(j.drafts));
      })
      .catch(() => {
        setDrafts([]);
        setIsCreator(false);
      });
  }, [publicKey]);

  // Buckets
  const buckets = useMemo(() => {
    const active: Proposal[] = [];
    const scheduled: Proposal[] = [];
    const ended: Proposal[] = [];
    const cancelled: Proposal[] = [];
    for (const p of proposals) {
      const s = effectiveStatus(p);
      if (s === "active") active.push(p);
      else if (s === "scheduled") scheduled.push(p);
      else if (s === "ended") ended.push(p);
      else if (s === "cancelled") cancelled.push(p);
    }
    return { active, scheduled, ended, cancelled };
  }, [proposals]);

  // Council "special vote" status
  const now = Date.now();
  const councilStatus =
    now < ELECTION_START.getTime()
      ? "scheduled"
      : now > ELECTION_END.getTime()
      ? "ended"
      : "active";
  const councilTimeLabel =
    councilStatus === "active"
      ? `Ends in ${formatCountdown(ELECTION_END)}`
      : councilStatus === "scheduled"
      ? `Starts in ${formatCountdown(ELECTION_START)}`
      : `Ended ${formatCountdown(ELECTION_END)}`;

  const visible =
    tab === "all"
      ? proposals
      : tab === "active"
      ? buckets.active
      : tab === "scheduled"
      ? buckets.scheduled
      : buckets.ended;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page header */}
      <div className="mb-6 sm:mb-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white uppercase tracking-tight mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            DAOry <span className="text-daory-cyan">Proposals</span>
          </h1>
          <p className="text-sm sm:text-base text-daory-muted max-w-2xl leading-relaxed">
            Vote on community proposals with your Aurorian NFTs. Each NFT = one vote.
            {" "}
            <Link href="/delegate" className="text-daory-cyan hover:underline">
              Use a delegated voting wallet
            </Link>
            {" "}to keep your holder wallet safe.
          </p>
        </div>
        {isCreator && (
          <Link
            href="/proposals/new"
            className="px-4 sm:px-5 py-2.5 bg-daory-cyan text-black font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-daory-cyan-dark transition-colors whitespace-nowrap"
          >
            + New Proposal
          </Link>
        )}
      </div>

      {/* Council Special Vote card */}
      <div className="mb-8 sm:mb-10">
        <SpecialVoteCard
          href="/council"
          title="Council Election 2026"
          subtitle="Vote for the next DAOry Council. Up to 5 councillors and 3 advisors. This is a special multi-candidate vote that runs in parallel with regular proposals."
          cta={councilStatus === "ended" ? "View Results" : "Go to Vote"}
          status={councilStatus}
          timeLabel={councilTimeLabel}
        />
      </div>

      {/* Drafts (only visible to creator who owns them) */}
      {drafts.length > 0 && (
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] sm:text-[13px] font-bold uppercase tracking-widest text-daory-muted">
              Your Drafts ({drafts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {drafts.map((d) => (
              <Link
                key={d.id}
                href={`/proposals/${d.slug}/edit`}
                className="bg-daory-card border border-daory-border hover:border-daory-cyan transition-colors p-4 flex flex-col gap-2"
              >
                <span className="text-[10px] uppercase tracking-wider font-bold text-daory-muted">
                  Draft &middot; {d.category}
                </span>
                <h3
                  className="text-base font-bold text-white uppercase tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {d.title}
                </h3>
                <span className="text-xs text-daory-cyan font-bold uppercase tracking-wider mt-auto">
                  Edit Draft →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + stats */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 sm:mb-5">
        <div className="flex items-center gap-px bg-daory-border">
          {(["active", "scheduled", "ended", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === t
                  ? "bg-daory-card text-daory-cyan border-b-2 border-daory-cyan"
                  : "bg-daory-card text-daory-muted hover:text-white"
              }`}
            >
              {t} (
              {t === "all"
                ? proposals.length
                : t === "active"
                ? buckets.active.length
                : t === "scheduled"
                ? buckets.scheduled.length
                : buckets.ended.length}
              )
            </button>
          ))}
        </div>
        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-daory-muted">
          {TOTAL_SNAPSHOT_NFTS.toLocaleString()} eligible NFTs
        </div>
      </div>

      {/* Proposal grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-daory-muted text-sm">Loading proposals…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-daory-card border border-daory-border p-8 sm:p-12 text-center">
          <p className="text-daory-muted text-sm">
            No {tab === "all" ? "" : tab} proposals
            {tab === "active" ? " right now" : ""}.
          </p>
          {tab === "active" && proposals.length === 0 && isCreator && (
            <Link
              href="/proposals/new"
              className="inline-block mt-4 px-5 py-2.5 border border-daory-cyan text-daory-cyan font-bold uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
            >
              Create the first proposal
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visible.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {/* Refresh hint */}
      <div className="text-center text-[10px] sm:text-xs text-daory-muted py-8">
        <span className="inline-block w-2 h-2 rounded-full bg-daory-cyan animate-pulse mr-2" />
        Auto-refreshing every 30 seconds
      </div>
    </div>
  );
}
