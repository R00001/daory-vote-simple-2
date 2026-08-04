import fs from "fs";
import path from "path";

let ownerToMints: Map<string, string[]> | null = null;
let mintToOwner: Map<string, string> | null = null;

function loadSnapshot() {
  if (ownerToMints && mintToOwner) return;

  ownerToMints = new Map();
  mintToOwner = new Map();

  const csvPath = path.join(process.cwd(), "data", "snapshot.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Columns are Mint,Owner[,Note] - the optional Note is informational only.
    const [mint, owner] = line.split(",");
    if (!mint || !owner) continue;

    mintToOwner.set(mint, owner);

    const existing = ownerToMints.get(owner);
    if (existing) {
      existing.push(mint);
    } else {
      ownerToMints.set(owner, [mint]);
    }
  }
}

export function getMintsForOwner(wallet: string): string[] {
  loadSnapshot();
  return ownerToMints!.get(wallet) || [];
}

export function isEligibleWallet(wallet: string): boolean {
  loadSnapshot();
  return ownerToMints!.has(wallet);
}

export function getMintOwner(mint: string): string | null {
  loadSnapshot();
  return mintToOwner!.get(mint) || null;
}
