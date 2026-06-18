export type ProposalCategory =
  | "Treasury"
  | "Governance"
  | "Community"
  | "Marketing"
  | "Partnership"
  | "Other";

export const PROPOSAL_CATEGORIES: ProposalCategory[] = [
  "Treasury",
  "Governance",
  "Community",
  "Marketing",
  "Partnership",
  "Other",
];

export type ProposalType = "single_choice" | "multi_choice";

export type ProposalStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "ended"
  | "cancelled";

export interface ProposalOption {
  id: string;
  label: string;
}

export interface Proposal {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string;
  category: ProposalCategory;
  discussion_url: string | null;

  type: ProposalType;
  options: ProposalOption[];
  max_choices: number | null;
  allow_vote_change: boolean;

  starts_at: string;
  ends_at: string;
  discussion_period_hours: number;

  quorum_nfts: number | null;
  quorum_pct: number | null;
  approval_threshold_pct: number;
  binding: boolean;

  show_results_during: boolean;
  show_voter_list: boolean;

  status: ProposalStatus;
  cancelled_reason: string | null;

  creator_wallet: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalTally {
  option_id: string;
  vote_count: number;
  unique_voters: number;
}

export interface ProposalVoteRequest {
  proposalId: string;
  wallet: string;
  optionIds: string[];
  mintAddresses: string[];
  signature: string;
  message: string;
}

export interface ProposalCreateRequest {
  title: string;
  slug?: string;
  summary?: string;
  description: string;
  category: ProposalCategory;
  discussion_url?: string;

  type: ProposalType;
  options: ProposalOption[];
  max_choices?: number;
  allow_vote_change: boolean;

  starts_at: string;
  ends_at: string;
  discussion_period_hours: number;

  quorum_nfts?: number;
  quorum_pct?: number;
  approval_threshold_pct: number;
  binding: boolean;

  show_results_during: boolean;
  show_voter_list: boolean;

  publish: boolean;

  wallet: string;
  signature: string;
  message: string;
}

/** Default seeded options for a new proposal. Fully editable by the creator. */
export const DEFAULT_OPTIONS: ProposalOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "abstain", label: "Abstain" },
];

/**
 * True when the option set is a Yes/No(/Abstain) configuration — used by the
 * voter UI to render colored buttons instead of a generic radio list.
 */
export function isYesNoStyle(options: ProposalOption[]): boolean {
  if (options.length < 2 || options.length > 3) return false;
  const ids = options.map((o) => o.id);
  if (ids[0] !== "yes" || ids[1] !== "no") return false;
  if (options.length === 3 && ids[2] !== "abstain") return false;
  return true;
}
