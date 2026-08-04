#!/usr/bin/env node
/**
 * Map legacy Token Metadata (v1) Aurorian mints to their Metaplex Core (v2) asset.
 *
 * Aurory migrated in June 2024 with an atomic transaction per NFT:
 *
 *   1. Token Metadata `Update`   -> v1 metadata repointed to unverified-metadata.json
 *   2. Token Metadata `Unverify` -> collection + creator verification stripped from v1
 *   3. Core `Transfer`           -> the new Core asset sent to the v1 holder
 *
 * Because both the old mint and the new asset appear in the SAME transaction,
 * that transaction is an authoritative 1:1 link. The Core `Transfer` accounts
 * are ordered [asset, collection, payer, ...], so accounts[0] is the new asset
 * and accounts[1] must be the Aurorians collection.
 *
 * The "Aurorian #N" number is kept as an independent cross-check: it is unique
 * among live Core assets (all duplicate numbers belong to burnt assets).
 *
 * Usage:
 *   node --env-file=.env scripts/map-v1-to-core.mjs --mints <file> [--out <csv>]
 *   node --env-file=.env scripts/map-v1-to-core.mjs <mint> [<mint> ...]
 */

import fs from "node:fs";
import path from "node:path";

const CORE_PROGRAM = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const AURORIANS = "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr";

/**
 * Most NFTs migrated on 2024-06-05, but stragglers were still being converted
 * in July and August, so the upper bound has to be generous.
 */
const MIGRATION_FROM = Date.UTC(2024, 4, 25) / 1000; // 2024-05-25
const MIGRATION_TO = Date.UTC(2025, 0, 1) / 1000; // 2025-01-01

const args = process.argv.slice(2);
const consumed = new Set();
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1 || !args[i + 1]) return fallback;
  consumed.add(i + 1);
  return args[i + 1];
};

const mintsFile = opt("--mints", null);
const outPath = opt("--out", null);
const positional = args.filter((a, i) => !a.startsWith("--") && !consumed.has(i));

const mints = mintsFile
  ? fs
      .readFileSync(mintsFile, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      // Accept bare mints or moonrank/explorer URLs.
      .map((l) => l.split("/").pop())
      .filter(Boolean)
  : positional;

if (mints.length === 0) {
  console.error("No mints given. Use --mints <file> or pass them as arguments.");
  process.exit(1);
}

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : process.env.SOLANA_RPC_URL);

if (!RPC_URL) {
  console.error("No RPC configured. Set HELIUS_API_KEY.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let rpcCalls = 0;

async function rpc(method, params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "map", method, params }),
    });
    rpcCalls++;

    if (res.status === 429 || res.status >= 500) {
      await sleep(400 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(`${method}: ${json.error.message}`);
    return json.result;
  }
  throw new Error(`${method}: rate limited`);
}

const aurorianNumber = (name) => {
  const m = (name ?? "").match(/#(\d+)/);
  return m ? Number(m[1]) : null;
};

/**
 * Walk the v1 mint's history and return the Core asset it was migrated into.
 *
 * Two migration mechanisms exist, both putting old mint and new asset in one tx:
 *   - admin bulk swap    : Update + Unverify + Core Transfer   (Jun-Jul 2024)
 *   - user claim via ocil: IncNonce + TransferChecked + Core Transfer + freeze
 *
 * Failed attempts are tracked separately: a reverted migration still names the
 * Core asset Aurory intended, which is a usable fallback when nothing landed.
 */
async function traceMigration(mint) {
  let before;
  let failedCandidate = null;

  // Heavily traded mints carry 800+ signatures, so page deep enough to reach
  // back past the migration before giving up.
  for (let page = 0; page < 30; page++) {
    const sigs = await rpc("getSignaturesForAddress", [
      mint,
      before ? { limit: 100, before } : { limit: 100 },
    ]);
    if (sigs.length === 0) return null;

    for (const sig of sigs) {
      // Signatures come newest-first; stop once we are past the migration.
      if (sig.blockTime && sig.blockTime < MIGRATION_FROM) return failedCandidate;
      if (sig.blockTime && sig.blockTime > MIGRATION_TO) continue;

      const tx = await rpc("getTransaction", [
        sig.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx) continue;

      const keys = (tx.transaction.message.accountKeys ?? []).map(
        (k) => k.pubkey
      );
      const coreIx = (tx.transaction.message.instructions ?? []).find(
        (i) => i.programId === CORE_PROGRAM && (i.accounts ?? []).length >= 2
      );
      if (!coreIx) continue;

      const [asset, collection] = coreIx.accounts;
      if (collection !== AURORIANS) continue;
      // Sanity: the old mint really is part of this transaction.
      if (!keys.includes(mint)) continue;

      const hit = { asset, signature: sig.signature, blockTime: sig.blockTime };
      if (sig.err) {
        failedCandidate ??= { ...hit, method: "failed-migration-tx" };
        continue;
      }
      return { ...hit, method: "trace" };
    }
    before = sigs[sigs.length - 1].signature;
  }
  return failedCandidate;
}

async function getAssets(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000);
    const result = await rpc("getAssetBatch", { ids: batch });
    for (const asset of result ?? []) if (asset) out.set(asset.id, asset);
  }
  return out;
}

async function main() {
  console.log(`v1 mints: ${mints.length}\n`);

  const v1Assets = await getAssets(mints);

  const rows = [];
  let done = 0;
  for (const mint of mints) {
    const v1 = v1Assets.get(mint);
    const name = v1?.content?.metadata?.name ?? "";
    const hit = await traceMigration(mint);

    rows.push({
      mint,
      name,
      number: aurorianNumber(name),
      core: hit?.asset ?? "",
      signature: hit?.signature ?? "",
      method: hit?.method ?? "",
      v1Owner: v1?.ownership?.owner ?? "",
      v1Burnt: v1?.burnt === true,
    });
    process.stdout.write(`\r  traced ${++done}/${mints.length}`);
  }
  process.stdout.write("\n");

  // Last resort: the "Aurorian #N" number, which is unique among live Core
  // assets (every duplicate number belongs to a burnt one).
  const unmapped = rows.filter((r) => !r.core && r.number != null);
  if (unmapped.length > 0) {
    console.log(`\n  ${unmapped.length} unmapped, matching by number...`);
    const byNumber = new Map();
    for (let page = 1; ; page++) {
      const result = await rpc("getAssetsByGroup", {
        groupKey: "collection",
        groupValue: AURORIANS,
        page,
        limit: 1000,
      });
      const items = result?.items ?? [];
      if (items.length === 0) break;
      for (const item of items) {
        if (item.burnt) continue;
        const n = aurorianNumber(item.content?.metadata?.name);
        if (n != null) byNumber.set(n, item.id);
      }
      if (items.length < 1000) break;
    }
    for (const row of unmapped) {
      const id = byNumber.get(row.number);
      if (id) {
        row.core = id;
        row.method = "number";
      }
    }
  }

  // Cross-check: does the traced Core asset carry the same Aurorian number?
  const coreIds = rows.map((r) => r.core).filter(Boolean);
  const coreAssets = await getAssets(coreIds);

  let agree = 0;
  let disagree = 0;
  for (const row of rows) {
    const core = coreAssets.get(row.core);
    row.coreName = core?.content?.metadata?.name ?? "";
    row.coreOwner = core?.ownership?.owner ?? "";
    if (!row.core) continue;
    if (aurorianNumber(row.coreName) === row.number) agree++;
    else disagree++;
  }

  const mapped = rows.filter((r) => r.core).length;
  console.log(`\nmapped: ${mapped}/${rows.length}`);
  const methods = new Map();
  for (const r of rows.filter((x) => x.core)) {
    methods.set(r.method, (methods.get(r.method) ?? 0) + 1);
  }
  for (const [m, c] of methods) console.log(`  ${m.padEnd(20)} ${c}`);
  console.log(`number cross-check: ${agree} agree, ${disagree} disagree`);

  if (disagree > 0) {
    console.log("\nDISAGREEMENTS (the on-chain trace wins):");
    for (const r of rows) {
      if (r.core && aurorianNumber(r.coreName) !== r.number) {
        console.log(
          `  ${r.mint}\n    v1  = "${r.name}"\n    core= "${r.coreName}"  (${r.method})`
        );
      }
    }
  }

  const failed = rows.filter((r) => !r.core);
  if (failed.length > 0) {
    console.log(`\nUNMAPPED (${failed.length}):`);
    for (const r of failed) console.log(`  ${r.mint}  "${r.name}"`);
  }

  const csv =
    ["V1Mint,CoreAsset,V1Name,CoreName,Method,V1Owner,CoreOwner,MigrationTx"]
      .concat(
        rows.map((r) =>
          [
            r.mint,
            r.core,
            r.name,
            r.coreName,
            r.method,
            r.v1Owner,
            r.coreOwner,
            r.signature,
          ].join(",")
        )
      )
      .join("\n") + "\n";

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, csv);
    console.log(`\nwritten: ${outPath}`);
  } else {
    console.log(`\n${csv}`);
  }
  console.log(`rpc calls: ${rpcCalls}`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
