"use client";

import Link from "next/link";
import { Proposal } from "@/types/proposal";
import { CATEGORY_STYLE, STATUS_STYLE, effectiveStatus, formatCountdown } from "@/lib/proposals";

interface ProposalCardProps {
  proposal: Proposal;
  href?: string;
}

const TYPE_LABEL: Record<Proposal["type"], string> = {
  single_choice: "Pick One",
  multi_choice: "Pick Multiple",
};

export default function ProposalCard({ proposal, href }: ProposalCardProps) {
  const status = effectiveStatus(proposal);
  const target = href ?? `/proposals/${proposal.slug}`;
  const statusStyle = STATUS_STYLE[status];
  const catStyle = CATEGORY_STYLE[proposal.category] ?? CATEGORY_STYLE.Other;

  const isActive = status === "active";
  const isScheduled = status === "scheduled";
  const isEnded = status === "ended";

  const timeLabel = isActive
    ? `Ends in ${formatCountdown(proposal.ends_at)}`
    : isScheduled
    ? `Starts in ${formatCountdown(proposal.starts_at)}`
    : isEnded
    ? `Ended ${formatCountdown(proposal.ends_at)}`
    : "";

  return (
    <Link
      href={target}
      className="group bg-daory-card border border-daory-border hover:border-daory-border-hover transition-colors p-4 sm:p-5 flex flex-col gap-3"
    >
      {/* Top row: chips */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${catStyle.chip}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-sm align-middle mr-1.5 ${catStyle.dot}`} />
            {proposal.category}
          </span>
          {proposal.binding && (
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-daory-cyan/10 text-daory-cyan border border-daory-cyan/30">
              Binding
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${statusStyle.chip}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Title + summary */}
      <div>
        <h3
          className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight group-hover:text-daory-cyan transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {proposal.title}
        </h3>
        {proposal.summary && (
          <p className="text-sm text-daory-muted mt-1 line-clamp-2 leading-relaxed">
            {proposal.summary}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-daory-border text-[11px] uppercase tracking-wider">
        <span className="text-daory-muted">
          <span className="text-white font-bold">{TYPE_LABEL[proposal.type]}</span>
        </span>
        {timeLabel && (
          <span className={isActive ? "text-daory-cyan font-bold" : "text-daory-muted"}>
            {timeLabel}
          </span>
        )}
      </div>
    </Link>
  );
}

interface SpecialVoteCardProps {
  href: string;
  title: string;
  subtitle: string;
  cta: string;
  status: "active" | "ended" | "scheduled";
  timeLabel?: string;
}

/** Highlight card for the council election (the "special vote"). */
export function SpecialVoteCard({
  href,
  title,
  subtitle,
  cta,
  status,
  timeLabel,
}: SpecialVoteCardProps) {
  const statusStyle = STATUS_STYLE[status];
  return (
    <Link
      href={href}
      className="group block bg-daory-card border border-daory-cyan/40 hover:border-daory-cyan transition-colors p-5 sm:p-6 shadow-lg shadow-daory-cyan/10"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-daory-cyan text-black">
          Special Vote
        </span>
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${statusStyle.chip}`}>
          {statusStyle.label}
        </span>
      </div>
      <h2
        className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight mb-1 group-hover:text-daory-cyan transition-colors"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>
      <p className="text-sm text-daory-muted leading-relaxed mb-4">{subtitle}</p>
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-daory-border">
        <span className="text-sm font-bold text-daory-cyan uppercase tracking-wider">
          {cta} →
        </span>
        {timeLabel && (
          <span className="text-[11px] uppercase tracking-wider text-daory-muted">{timeLabel}</span>
        )}
      </div>
    </Link>
  );
}
