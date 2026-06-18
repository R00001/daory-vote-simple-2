import { PublicKey } from "@solana/web3.js";

/**
 * Parses PROPOSAL_CREATOR_WALLETS env var.
 * Format: comma-separated base58 Solana wallet addresses.
 * Invalid entries are silently dropped (server logs a warning).
 */
function parseWhitelist(): Set<string> {
  const raw = process.env.PROPOSAL_CREATOR_WALLETS || "";
  const wallets = new Set<string>();
  for (const entry of raw.split(",")) {
    const w = entry.trim();
    if (!w) continue;
    try {
      new PublicKey(w);
      wallets.add(w);
    } catch {
      console.warn(`[creators] dropped invalid wallet from whitelist: ${w}`);
    }
  }
  return wallets;
}

let cached: Set<string> | null = null;

export function getCreatorWhitelist(): Set<string> {
  if (!cached) cached = parseWhitelist();
  return cached;
}

export function isAuthorizedCreator(wallet: string): boolean {
  return getCreatorWhitelist().has(wallet);
}
