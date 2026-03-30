// Election rules
export const MAX_COUNCILLOR_PICKS = 5;
export const MAX_ADVISOR_PICKS = 3;
export const COUNCILLOR_SEATS = 5;
export const ADVISOR_SEATS = 3;
export const TOTAL_SNAPSHOT_NFTS = 9997;

// Election window (adjust before launch)
export const ELECTION_START = new Date("2026-04-01T15:00:00Z"); // Wed 1 Apr 17:00 CET
export const ELECTION_END = new Date("2026-04-13T15:00:00Z");   // Sun 13 Apr 17:00 CET

// Councillor roles (not Advisor)
export const COUNCILLOR_ROLES = [
  "Community & Outreach",
  "Finance & Investment",
  "Infrastructure & Development",
] as const;
