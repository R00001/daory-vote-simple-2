// Shared ballot message creation - used by both client and server
// For large collections (600+ NFTs), we hash the mint list instead of
// embedding all addresses in the signed message to keep it small.

export function hashMints(mints: string[]): string {
  // Sort for deterministic hash
  const sorted = [...mints].sort();
  const joined = sorted.join(",");

  // Simple hash using Web Crypto-compatible approach
  // We use a basic FNV-1a hash that works in both browser and Node
  let hash = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createBallotMessage(
  candidateIds: string[],
  mintAddresses: string[],
  timestamp: string
): string {
  const mintRef =
    mintAddresses.length > 20
      ? `${mintAddresses.length} NFTs [hash:${hashMints(mintAddresses)}]`
      : mintAddresses.join(",");

  return [
    "DAOry Council Election Ballot",
    `Candidates: ${candidateIds.join(",")}`,
    `NFTs: ${mintRef}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}
