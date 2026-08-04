#!/usr/bin/env node
/**
 * Snapshot of holders for a Metaplex Core (MPL Core) collection.
 *
 * Core assets are a SINGLE account: there is no mint, no ATA, no token account.
 * The holder lives in the `owner` field of the asset account itself, and the
 * collection link lives in `update_authority` (UpdateAuthority::Collection).
 *
 * AssetV1 layout (relevant prefix):
 *   offset  0 : u8    key            (1 = AssetV1)
 *   offset  1 : [u8;32] owner
 *   offset 33 : u8    update_authority discriminant (0=None, 1=Address, 2=Collection)
 *   offset 34 : [u8;32] update_authority payload
 *
 * Two independent sources are used and cross-checked:
 *   1. DAS (getAssetsByGroup) — fast, and the only way to read plugin state.
 *   2. getProgramAccounts on the Core program — raw chain truth for `owner`.
 *
 * Usage:
 *   node --env-file=.env scripts/snapshot-core.mjs <collectionAddress> [options]
 *
 * Options:
 *   --verify            cross-check every owner against getProgramAccounts
 *   --resolve-escrow    resolve marketplace/loan escrows back to the real holder
 *   --exclude <path>    CSV of wallets to drop (Wallet,Category,Reason header)
 *   --out <path>        output CSV (default data/snapshot.csv)
 *
 * Output columns: Mint,Owner,Note — see buildNote() for the Note vocabulary.
 * Default collection is Aurorians (Aurory).
 */

import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";

const CORE_PROGRAM = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const AURORIANS = "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/**
 * Programs that legitimately hold Core assets on behalf of a user. An asset
 * sitting here is still *someone's* — the owner field just points at escrow.
 */
const ESCROW_PROGRAMS = {
  M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K: { label: "magic-eden", kind: "listed" },
  TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp: { label: "tensor", kind: "listed" },
  cyGDqgWPk7tDDTx99Jh4PhBquRHSNNkuf1rmEmUcrZq: { label: "core-lending", kind: "loan" },
};

/**
 * Note column vocabulary, `|`-separated so the CSV stays comma-free:
 *   syncspace              frozen by Aurory's PermanentFreezeDelegate
 *   listed:<marketplace>   held by a marketplace escrow
 *   loan:<program>         held as loan collateral
 *   escrow:<program>       held by an unidentified program
 *   owner-unresolved       Owner is still the escrow, not a person
 */
function buildNote(row) {
  const parts = [];
  if (row.locked) parts.push("syncspace");
  if (row.escrow) {
    parts.push(`${row.escrowKind}:${row.escrow}`);
    if (!row.resolved) parts.push("owner-unresolved");
  }
  return parts.join("|");
}

/** Co-signers that are marketplace infrastructure, never the actual seller. */
const NOT_A_HOLDER = new Set([
  "NTYeYJ1wr4bpM5xo6zx5En44SvJFAd35zTxxNoERYqd", // Magic Eden authority
  "1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix", // Magic Eden escrow wallet
]);

/** Tensor's ListState: 8 discriminator + 1 version + 1 bump, then the seller. */
const TENSOR_OWNER_OFFSET = 10;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);

/** Indices consumed as option values, so they aren't mistaken for the collection. */
const consumed = new Set();
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1 || !args[i + 1]) return fallback;
  consumed.add(i + 1);
  return args[i + 1];
};
const outPath = opt("--out", path.join("data", "snapshot.csv"));
const excludePath = opt("--exclude", null);

const collection =
  args.find((a, i) => !a.startsWith("--") && !consumed.has(i)) || AURORIANS;

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : process.env.SOLANA_RPC_URL);

if (!RPC_URL) {
  console.error(
    "No RPC configured. Set HELIUS_API_KEY (or HELIUS_RPC_URL / SOLANA_RPC_URL)."
  );
  process.exit(1);
}

let rpcCalls = 0;

async function rpc(method, params) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "snapshot", method, params }),
    });
    rpcCalls++;

    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(`${method}: ${json.error.message}`);
    return json.result;
  }
  throw new Error(`${method}: giving up after 5 attempts`);
}

/** Every asset DAS has indexed for the collection, burnt ones included. */
async function fetchAssetsViaDas() {
  const assets = [];
  for (let page = 1; ; page++) {
    const result = await rpc("getAssetsByGroup", {
      groupKey: "collection",
      groupValue: collection,
      page,
      limit: 1000,
    });
    const items = result?.items ?? [];
    if (items.length === 0) break;
    assets.push(...items);
    process.stdout.write(`\r  DAS: ${assets.length} assets`);
    if (items.length < 1000) break;
  }
  process.stdout.write("\n");
  return assets;
}

/** Raw chain truth: asset pubkey -> owner, straight from account bytes. */
async function fetchOwnersFromChain() {
  const filterBytes = Buffer.concat([
    Buffer.from([2]), // UpdateAuthority::Collection
    Buffer.from(bs58.decode(collection)),
  ]);

  const accounts = await rpc("getProgramAccounts", [
    CORE_PROGRAM,
    {
      encoding: "base64",
      dataSlice: { offset: 1, length: 32 }, // just the owner
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([1])) } },
        { memcmp: { offset: 33, bytes: bs58.encode(filterBytes) } },
      ],
    },
  ]);

  const owners = new Map();
  for (const acc of accounts) {
    const raw = Buffer.from(acc.account.data[0], "base64");
    owners.set(acc.pubkey, bs58.encode(raw));
  }
  return owners;
}

async function getAccountOwners(addresses) {
  const owners = new Map();
  for (let i = 0; i < addresses.length; i += 100) {
    const chunk = addresses.slice(i, i + 100);
    const result = await rpc("getMultipleAccounts", [
      chunk,
      { encoding: "base64" },
    ]);
    chunk.forEach((addr, j) => {
      // A null account is a wallet that has never been funded — still a wallet.
      owners.set(addr, result.value[j]?.owner ?? SYSTEM_PROGRAM);
    });
  }
  return owners;
}

/** Tensor stores the seller inside the listing PDA that owns the asset. */
async function resolveTensor(pdas) {
  const resolved = new Map();
  for (let i = 0; i < pdas.length; i += 100) {
    const chunk = pdas.slice(i, i + 100);
    const result = await rpc("getMultipleAccounts", [
      chunk,
      { encoding: "base64" },
    ]);
    chunk.forEach((pda, j) => {
      const data = result.value[j]?.data?.[0];
      if (!data) return;
      const raw = Buffer.from(data, "base64");
      if (raw.length < TENSOR_OWNER_OFFSET + 32) return;
      resolved.set(
        pda,
        bs58.encode(raw.subarray(TENSOR_OWNER_OFFSET, TENSOR_OWNER_OFFSET + 32))
      );
    });
  }
  return resolved;
}

/**
 * Generic fallback: walk the asset's history back to the transfer that moved it
 * into escrow, and take the human signer of that transaction.
 */
async function resolveViaHistory(assetId, maxPages = 4) {
  let before = undefined;

  for (let page = 0; page < maxPages; page++) {
    const sigs = await rpc("getSignaturesForAddress", [
      assetId,
      before ? { limit: 25, before } : { limit: 25 },
    ]);
    if (sigs.length === 0) return null;

    for (const { signature } of sigs) {
      const tx = await rpc("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      const logs = tx?.meta?.logMessages ?? [];
      // Metaplex fee-collection txs touch the asset but log no instruction.
      if (!logs.some((l) => l.includes("Instruction: Transfer"))) continue;

      const signers = (tx.transaction.message.accountKeys ?? [])
        .filter((k) => k.signer)
        .map((k) => k.pubkey)
        .filter((k) => !NOT_A_HOLDER.has(k));

      if (signers.length > 0) return signers[0];
    }
    before = sigs[sigs.length - 1].signature;
  }
  return null;
}

function toCsv(rows) {
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

async function main() {
  console.log(`Collection : ${collection}`);
  console.log(`Core prog  : ${CORE_PROGRAM}\n`);

  const dasAssets = await fetchAssetsViaDas();
  const live = dasAssets.filter((a) => !a.burnt);
  console.log(
    `  burnt (excluded): ${dasAssets.length - live.length}` +
      `   live: ${live.length}`
  );

  // The SyncSpace-style lock lives in the plugin, NOT in ownership.frozen.
  const isLocked = (a) =>
    a.plugins?.permanent_freeze_delegate?.data?.frozen === true ||
    a.plugins?.freeze_delegate?.data?.frozen === true;

  const rows = live.map((a) => ({
    mint: a.id,
    owner: a.ownership.owner,
    locked: isLocked(a),
    escrow: "",
    resolved: "",
  }));

  if (flag("--verify")) {
    console.log("\nVerifying against getProgramAccounts...");
    const chain = await fetchOwnersFromChain();
    console.log(`  chain: ${chain.size} accounts`);

    let missing = 0;
    let mismatched = 0;
    for (const row of rows) {
      const onChain = chain.get(row.mint);
      if (!onChain) {
        missing++;
        continue;
      }
      if (onChain !== row.owner) {
        mismatched++;
        row.owner = onChain; // chain wins
      }
    }
    console.log(`  not on chain: ${missing}   owner corrected: ${mismatched}`);
  }

  // Classify owners: real wallet vs program-owned escrow.
  const uniqueOwners = [...new Set(rows.map((r) => r.owner))];
  console.log(`\nClassifying ${uniqueOwners.length} owners...`);
  const ownerPrograms = await getAccountOwners(uniqueOwners);

  const escrowed = rows.filter((r) => {
    const prog = ownerPrograms.get(r.owner);
    if (prog === SYSTEM_PROGRAM) return false;
    const known = ESCROW_PROGRAMS[prog];
    r.escrow = known?.label ?? prog;
    r.escrowKind = known?.kind ?? "escrow";
    return true;
  });
  console.log(`  in escrow: ${escrowed.length}`);

  if (flag("--resolve-escrow") && escrowed.length > 0) {
    console.log("\nResolving escrowed assets...");

    const tensorPdas = [
      ...new Set(
        escrowed.filter((r) => r.escrow === "tensor").map((r) => r.owner)
      ),
    ];
    const tensorOwners = await resolveTensor(tensorPdas);

    let done = 0;
    for (const row of escrowed) {
      const candidate =
        tensorOwners.get(row.owner) ?? (await resolveViaHistory(row.mint));
      // Resolving to the escrow itself is a failure, not an answer.
      row.resolved = candidate && candidate !== row.owner ? candidate : "";
      process.stdout.write(`\r  resolved ${++done}/${escrowed.length}`);
    }
    process.stdout.write("\n");

    const failed = escrowed.filter((r) => !r.resolved).length;
    if (failed > 0) console.log(`  unresolved: ${failed} (owner left as escrow)`);
  }

  // The effective holder: resolved seller when escrowed, otherwise the owner.
  for (const row of rows) row.holder = row.resolved || row.owner;

  for (const row of rows) row.note = buildNote(row);

  // Wallets that hold assets but must not carry voting weight: the DAO itself,
  // the redeem address (no end holder behind it yet), and team wallets.
  let kept = rows;
  if (excludePath) {
    const excluded = new Map();
    for (const line of fs.readFileSync(excludePath, "utf-8").split("\n").slice(1)) {
      const [wallet, category] = line.trim().split(",");
      if (wallet) excluded.set(wallet, category ?? "excluded");
    }

    const dropped = rows.filter((r) => excluded.has(r.holder));
    kept = rows.filter((r) => !excluded.has(r.holder));

    console.log(`\nexcluding ${excluded.size} wallets from ${excludePath}`);
    const perWallet = new Map();
    for (const r of dropped) {
      perWallet.set(r.holder, (perWallet.get(r.holder) ?? 0) + 1);
    }
    for (const [w, n] of [...perWallet].sort((a, b) => b[1] - a[1])) {
      console.log(`  -${String(n).padStart(4)}  ${w}  [${excluded.get(w)}]`);
    }
    const unused = [...excluded.keys()].filter((w) => !perWallet.has(w));
    for (const w of unused) console.log(`  -   0  ${w}  [${excluded.get(w)}] (holds nothing)`);
    console.log(`  dropped ${dropped.length} assets, ${kept.length} remain`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    toCsv([
      ["Mint", "Owner", "Note"],
      ...kept.map((r) => [r.mint, r.holder, r.note]),
    ])
  );

  const holders = new Set(kept.map((r) => r.holder));
  const tally = new Map();
  for (const row of kept) {
    for (const part of row.note.split("|").filter(Boolean)) {
      tally.set(part, (tally.get(part) ?? 0) + 1);
    }
  }

  console.log(`\n--- snapshot ---`);
  console.log(`assets        : ${kept.length}`);
  console.log(`unique holders: ${holders.size}`);
  console.log(`plain (no note): ${kept.filter((r) => !r.note).length}`);
  for (const [note, count] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${note.padEnd(22)} ${count}`);
  }
  console.log(`rpc calls     : ${rpcCalls}`);
  console.log(`written       : ${outPath}`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
