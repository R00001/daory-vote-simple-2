export type CandidateRole =
  | "Community & Outreach"
  | "Finance & Investment"
  | "Infrastructure & Development"
  | "Advisor";

export interface Candidate {
  id: string;
  discordName: string;
  aurorianNumber: number;
  imageUrl: string;
  socials?: string;
  vision: string;
  role: CandidateRole;
  experience: string;
}

export interface AurorianNft {
  mint: string;
  number: number;
  imageUrl: string;
  hasVoted: boolean;
  votedFor?: string;
  hasMetadata?: boolean;
}

export interface EligibilityResponse {
  eligible: boolean;
  aurorians: AurorianNft[];
  delegatedFrom?: string;
}

export interface VoteRequest {
  wallet: string;
  candidateIds: string[];
  mintAddresses: string[];
  signature: string;
  message: string;
}

export interface VoteTally {
  candidate_id: string;
  vote_count: number;
}
