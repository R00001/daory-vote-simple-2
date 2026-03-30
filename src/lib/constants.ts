// Election rules
export const MAX_COUNCILLOR_PICKS = 5;
export const MAX_ADVISOR_PICKS = 3;
export const COUNCILLOR_SEATS = 5;
export const ADVISOR_SEATS = 3;
export const TOTAL_SNAPSHOT_NFTS = 9997;

// Election window (adjust before launch)
export const ELECTION_START = new Date("2026-03-30T00:00:00Z");
export const ELECTION_END = new Date("2026-04-06T23:59:59Z");

// Councillor roles (not Advisor)
export const COUNCILLOR_ROLES = [
  "Community & Outreach",
  "Finance & Investment",
  "Infrastructure & Development",
] as const;
