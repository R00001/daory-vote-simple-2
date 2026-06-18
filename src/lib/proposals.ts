import {
  Proposal,
  ProposalOption,
  ProposalStatus,
  ProposalTally,
  ProposalType,
  DEFAULT_OPTIONS,
} from "@/types/proposal";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function effectiveStatus(p: Pick<Proposal, "status" | "starts_at" | "ends_at">): ProposalStatus {
  if (p.status === "draft" || p.status === "cancelled") return p.status;
  const now = Date.now();
  const starts = new Date(p.starts_at).getTime();
  const ends = new Date(p.ends_at).getTime();
  if (now < starts) return "scheduled";
  if (now >= ends) return "ended";
  return "active";
}

export function isVotingOpen(p: Pick<Proposal, "status" | "starts_at" | "ends_at">): boolean {
  return effectiveStatus(p) === "active";
}

export function shouldRevealResults(p: Pick<Proposal, "status" | "starts_at" | "ends_at" | "show_results_during">): boolean {
  const s = effectiveStatus(p);
  if (s === "ended" || s === "cancelled") return true;
  return p.show_results_during;
}

export function getDefaultOptions(): ProposalOption[] {
  return DEFAULT_OPTIONS.map((o) => ({ ...o }));
}

export function validateOptionsForType(
  type: ProposalType,
  options: ProposalOption[],
  maxChoices?: number | null
): string | null {
  if (options.length < 2) return "At least 2 options required";
  if (options.length > 20) return "Too many options (max 20)";
  const ids = new Set<string>();
  for (const o of options) {
    if (!o.id || !o.label) return "Each option needs an id and label";
    if (!/^[a-z0-9_-]+$/i.test(o.id)) return `Invalid option id: ${o.id}`;
    if (o.id.length > 60) return `Option id too long: ${o.id}`;
    if (o.label.length > 120) return "Option label too long (max 120 chars)";
    if (ids.has(o.id)) return `Duplicate option id: ${o.id}`;
    ids.add(o.id);
  }
  if (type === "multi_choice") {
    if (!maxChoices || maxChoices < 1) return "max_choices required for multi_choice";
    if (maxChoices > options.length) return "max_choices cannot exceed number of options";
  }
  return null;
}

export interface TallyBreakdown {
  optionId: string;
  label: string;
  count: number;
  pct: number;
}

export interface ProposalSummaryStats {
  totalVotes: number;
  uniqueBallots: number;
  breakdown: TallyBreakdown[];
  topOptionId: string | null;
  passes: boolean | null;
  quorumMet: boolean | null;
}

export function summarizeTallies(
  proposal: Proposal,
  tallies: ProposalTally[],
  uniqueBallots: number,
  snapshotTotal: number
): ProposalSummaryStats {
  const totalVotes = tallies.reduce((s, t) => s + t.vote_count, 0);

  const breakdown: TallyBreakdown[] = proposal.options.map((o) => {
    const t = tallies.find((x) => x.option_id === o.id);
    const count = t?.vote_count ?? 0;
    return {
      optionId: o.id,
      label: o.label,
      count,
      pct: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
    };
  });

  const sorted = [...breakdown].sort((a, b) => b.count - a.count);
  const topOptionId = sorted[0]?.count > 0 ? sorted[0].optionId : null;

  // Quorum
  let quorumMet: boolean | null = null;
  if (proposal.quorum_nfts != null) {
    quorumMet = uniqueBallots >= proposal.quorum_nfts;
  } else if (proposal.quorum_pct != null && snapshotTotal > 0) {
    quorumMet = (uniqueBallots / snapshotTotal) * 100 >= proposal.quorum_pct;
  }

  // Pass: plurality — top option must reach approval_threshold_pct of total votes.
  // For Yes/No-style proposals this still works: "Yes" needs ≥ threshold% of votes.
  let passes: boolean | null = null;
  const top = sorted[0]?.count ?? 0;
  passes = totalVotes > 0
    ? (top / totalVotes) * 100 >= proposal.approval_threshold_pct
    : false;
  if (quorumMet === false) passes = false;

  return {
    totalVotes,
    uniqueBallots,
    breakdown,
    topOptionId,
    passes,
    quorumMet,
  };
}

export const CATEGORY_STYLE: Record<string, { dot: string; bar: string; chip: string }> = {
  Treasury:    { dot: "bg-emerald-500", bar: "bg-emerald-500", chip: "bg-emerald-600/15 text-emerald-400 border border-emerald-600/30" },
  Governance:  { dot: "bg-daory-cyan",  bar: "bg-daory-cyan",  chip: "bg-daory-cyan/15 text-daory-cyan border border-daory-cyan/30" },
  Community:   { dot: "bg-sky-500",     bar: "bg-sky-500",     chip: "bg-sky-600/15 text-sky-400 border border-sky-600/30" },
  Marketing:   { dot: "bg-amber-500",   bar: "bg-amber-500",   chip: "bg-amber-600/15 text-amber-400 border border-amber-600/30" },
  Partnership: { dot: "bg-purple-500",  bar: "bg-purple-500",  chip: "bg-purple-600/15 text-purple-400 border border-purple-600/30" },
  Other:       { dot: "bg-daory-muted", bar: "bg-daory-muted", chip: "bg-white/[0.05] text-daory-muted border border-daory-border" },
};

export const STATUS_STYLE: Record<ProposalStatus, { chip: string; label: string }> = {
  draft:     { chip: "bg-white/[0.05] text-daory-muted border border-daory-border",          label: "Draft" },
  scheduled: { chip: "bg-daory-cyan/10 text-daory-cyan border border-daory-cyan/30",         label: "Scheduled" },
  active:    { chip: "bg-emerald-600/15 text-emerald-400 border border-emerald-600/30",      label: "Active" },
  ended:     { chip: "bg-white/[0.05] text-daory-muted border border-daory-border",          label: "Ended" },
  cancelled: { chip: "bg-red-900/20 text-red-400 border border-red-800/40",                  label: "Cancelled" },
};

export function formatCountdown(target: string | Date, now: Date = new Date()): string {
  const t = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const diff = t - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  let s: string;
  if (d > 0) s = `${d}d ${h}h`;
  else if (h > 0) s = `${h}h ${m}m`;
  else s = `${m}m`;
  return past ? `${s} ago` : s;
}
