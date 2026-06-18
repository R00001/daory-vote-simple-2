import { hashMints } from "./ballot";

/**
 * Signed-message format for a proposal vote.
 * Mirrors the council ballot format conventions but namespaced for proposals.
 * For >20 NFTs the mint list is replaced with a deterministic FNV-1a hash.
 */
export function createProposalVoteMessage(
  proposalSlug: string,
  optionIds: string[],
  mintAddresses: string[],
  timestamp: string
): string {
  const mintRef =
    mintAddresses.length > 20
      ? `${mintAddresses.length} NFTs [hash:${hashMints(mintAddresses)}]`
      : mintAddresses.join(",");

  return [
    "DAOry Proposal Vote",
    `Proposal: ${proposalSlug}`,
    `Options: ${optionIds.join(",")}`,
    `NFTs: ${mintRef}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

/**
 * Signed-message format for creating or updating a proposal.
 * Includes a payload hash so the server can verify the signed wallet
 * agreed to the exact content being persisted.
 */
export function createProposalAuthorMessage(
  action: "create" | "update" | "publish" | "cancel",
  payloadHash: string,
  timestamp: string
): string {
  return [
    "DAOry Proposal Authoring",
    `Action: ${action}`,
    `Payload: ${payloadHash}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

/** Stable FNV-1a hash of a JSON-stringified payload (browser+node safe). */
export function hashPayload(payload: unknown): string {
  const stable = JSON.stringify(sortKeys(payload));
  let hash = 0x811c9dc5;
  for (let i = 0; i < stable.length; i++) {
    hash ^= stable.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  }
  return value;
}
