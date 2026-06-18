"use client";

import { useMemo } from "react";
import { Proposal, ProposalTally } from "@/types/proposal";
import { summarizeTallies, formatCountdown } from "@/lib/proposals";
import { TOTAL_SNAPSHOT_NFTS } from "@/lib/constants";

interface ProposalResultsProps {
  proposal: Proposal;
  tallies: ProposalTally[];
  uniqueBallots: number;
  revealed: boolean;
}

const OPTION_ACCENT: Record<string, { bar: string; text: string }> = {
  yes: { bar: "bg-emerald-500", text: "text-emerald-400" },
  no: { bar: "bg-red-500", text: "text-red-400" },
  abstain: { bar: "bg-amber-500", text: "text-amber-400" },
};

const DEFAULT_ACCENT = { bar: "bg-daory-cyan", text: "text-daory-cyan" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export default function ProposalResults({
  proposal,
  tallies,
  uniqueBallots,
  revealed,
}: ProposalResultsProps) {
  const summary = useMemo(
    () => summarizeTallies(proposal, tallies, uniqueBallots, TOTAL_SNAPSHOT_NFTS),
    [proposal, tallies, uniqueBallots]
  );

  const participationPct =
    TOTAL_SNAPSHOT_NFTS > 0 ? (uniqueBallots / TOTAL_SNAPSHOT_NFTS) * 100 : 0;

  if (!revealed) {
    return (
      <div className="bg-daory-card border border-daory-border p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3
            className="text-base font-bold text-white uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Results <span className="text-daory-cyan">Hidden</span>
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-daory-muted">
            Reveals in {formatCountdown(proposal.ends_at)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-daory-border mb-4">
          <Stat label="Ballots Cast" value={fmt(uniqueBallots)} accent />
          <Stat label="Participation" value={`${participationPct.toFixed(1)}%`} />
          <Stat label="Snapshot" value={fmt(TOTAL_SNAPSHOT_NFTS)} sub="NFTs" />
        </div>
        <p className="text-xs text-daory-muted">
          Tallies will be revealed when voting ends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + decision */}
      <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3
            className="text-base font-bold text-white uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Live <span className="text-daory-cyan">Tallies</span>
          </h3>
          {summary.passes !== null && (
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${
                summary.passes
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-600/30"
                  : "bg-red-900/20 text-red-400 border border-red-800/40"
              }`}
            >
              {summary.passes ? "Passing" : "Failing"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-daory-border mb-4">
          <Stat label="Ballots" value={fmt(uniqueBallots)} accent />
          <Stat label="Total Votes" value={fmt(summary.totalVotes)} sub="across options" />
          <Stat label="Participation" value={`${participationPct.toFixed(1)}%`} sub={`of ${fmt(TOTAL_SNAPSHOT_NFTS)} NFTs`} />
          <Stat
            label="Threshold"
            value={`${proposal.approval_threshold_pct}%`}
            sub={
              proposal.quorum_nfts != null
                ? `Quorum ${summary.quorumMet === false ? "✗" : "✓"} ${proposal.quorum_nfts} NFTs`
                : proposal.quorum_pct != null
                ? `Quorum ${summary.quorumMet === false ? "✗" : "✓"} ${proposal.quorum_pct}%`
                : "No quorum required"
            }
          />
        </div>

        <div className="space-y-2.5">
          {summary.breakdown.map((b) => {
            const accent = OPTION_ACCENT[b.optionId] ?? DEFAULT_ACCENT;
            const isTop = summary.topOptionId === b.optionId;
            return (
              <div key={b.optionId}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${isTop ? accent.text : "text-white"}`}>
                    {isTop && <span className="mr-1">★</span>}
                    {b.label}
                  </span>
                  <span className="text-xs text-daory-muted tabular-nums">
                    <span className="text-white font-bold">{fmt(b.count)}</span> votes &middot;{" "}
                    {b.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full ${accent.bar} transition-all duration-700`}
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-daory-card p-3 sm:p-4">
      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
        {label}
      </div>
      <div
        className={`text-lg sm:text-2xl font-extrabold tracking-tight leading-none ${
          accent ? "text-daory-cyan" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-daory-muted mt-1">{sub}</div>}
    </div>
  );
}
