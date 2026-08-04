# DAOry Vote

NFT-gated governance platform for the DAOry community. Aurorian holders cast signed ballots on:

- **Proposals** — community votes (Yes/No, multi-option, multi-choice) created in-app by whitelisted council members
- **Special votes** — pre-defined campaigns that don't fit the regular proposal mold; currently the **Council Election** (5 councillors + 3 advisors)

One Aurorian NFT = one vote per proposal. Holders can vote from a delegated wallet so the holder wallet never touches the site.

Built with Next.js 16, Supabase, Solana wallet adapters, TipTap, and Chart.js.

## What's on the site

| Route | Purpose |
|---|---|
| `/` | Proposals list — active, scheduled, ended, all. Council Election is pinned as a "Special Vote" card on top. |
| `/proposals/[slug]` | Single proposal: title, description, voting UI, live results. |
| `/proposals/new` | Create a new proposal (whitelisted creator wallets only). |
| `/proposals/[slug]/edit` | Edit a draft proposal (creator wallet only). |
| `/council` | Council Election ballot (multi-candidate vote with role buckets). |
| `/council/results` | Council Election results dashboard with charts. |
| `/delegate` | Wallet delegation flow (proof-of-ownership via micro-SOL transfer). |

## How it works

### Voting on a proposal

1. **Connect a wallet** (Phantom, Solflare, or a delegated voting wallet).
2. **Pick your option(s)** — the UI adapts to the proposal type:
   - When the options are exactly `Yes / No` or `Yes / No / Abstain`: large coloured buttons.
   - Otherwise: standard radio list (`Pick One`) or checkboxes (`Pick Multiple`).
3. **Select which Aurorian NFTs vote** — each NFT can submit one ballot per proposal. Holders with multiple NFTs get proportional weight.
4. **Sign the ballot message** — no on-chain transaction, just a wallet signature.
5. **Server verifies** signature + snapshot ownership + signed message freshness, then writes the ballot through an atomic PL/pgSQL function.

If the proposal allows vote changes (`allow_vote_change = true`), the voter can re-sign at any time before `ends_at` and the previous ballot is replaced atomically.

### Creating a proposal

Only wallets in the `PROPOSAL_CREATOR_WALLETS` env var can create proposals. Flow:

1. Connect a whitelisted wallet on `/proposals/new`.
2. Fill in title, description (TipTap rich text), category, voting options (defaults to Yes/No/Abstain, fully editable — add, remove, relabel), schedule.
3. Optional **Advanced**: discussion period, quorum (none / min-NFTs / % of snapshot), approval threshold, binding flag, results visibility, voter-list visibility.
4. **Save Draft** (stays hidden) or **Publish Now** (goes live according to `starts_at`).
5. Server validates payload + verifies a signed authoring message + checks wallet against the whitelist.

Drafts are listed on the home page under "Your Drafts" for the wallet that authored them.

### Wallet delegation

For holders who prefer not to connect their Aurorian wallet to a web app:

1. Enter your Aurorian wallet address and a separate voting wallet on `/delegate`.
2. Server generates a unique micro-SOL amount (e.g. `0.0000541823 SOL`).
3. Send that exact amount from your Aurorian wallet to your voting wallet using your own wallet app.
4. Paste the transaction signature to verify.
5. Connect the voting wallet anywhere on the site. The Aurorian wallet never connects to the app — ownership is proved by the on-chain transfer (sender, recipient, exact amount, TX age, replay protection).

Delegation works identically for proposals and the council election.

## Architecture

```
src/
  app/
    page.tsx                          # Proposals home (list + Council special card + drafts)
    layout.tsx                        # Wallet provider + header + footer + fonts
    council/
      page.tsx                        # Council Election ballot UI (5 + 3 picks)
      results/page.tsx                # Council results dashboard with charts
    proposals/
      new/page.tsx                    # Create proposal (whitelist gated)
      [slug]/
        page.tsx                      # Proposal view + vote + live tallies + creator actions
        edit/page.tsx                 # Edit a draft proposal
    delegate/page.tsx                 # Wallet delegation flow
    api/
      proposals/
        route.ts                      # GET list (non-drafts), POST create
        [id]/
          route.ts                    # GET detail, PATCH update / publish / cancel
          vote/route.ts               # POST ballot (signature + snapshot + atomic RPC)
          results/route.ts            # GET tallies (respects show_results_during + status)
          my-vote/route.ts            # GET wallet's existing votes on a proposal
        drafts/route.ts               # GET caller's own drafts (whitelist gated)
      vote/route.ts                   # Legacy council ballot endpoint
      results/route.ts                # Legacy council results endpoint
      eligibility/route.ts            # NFT lookup + already-voted check
      delegate/
        request/route.ts              # Generate verification amount
        verify/route.ts               # Verify on-chain transfer

  lib/
    proposals.ts                      # Status compute, slugify, summarizeTallies, style tokens
    proposal-message.ts               # Signed message format for votes + authoring
    creators.ts                       # PROPOSAL_CREATOR_WALLETS parser
    sanitize.ts                       # TipTap HTML sanitizer (sanitize-html)
    ballot.ts                         # Council ballot message + FNV-1a hash for >20 NFTs
    candidates.ts                     # Hardcoded council candidate data
    constants.ts                      # Council election rules (seats, dates, roles)
    helius.ts                         # Helius DAS API for NFT metadata
    snapshot.ts                       # CSV snapshot loaded into memory Maps
    supabase.ts                       # Read client (anon) + Admin client (service role)
    verify-signature.ts               # tweetnacl signature verification

  components/
    Header.tsx                        # Proposals · Council · Delegate · Connect
    ConnectButton.tsx
    DelegateWallet.tsx                # Delegation step-by-step flow
    NftSelector.tsx                   # NFT grid with compact mode for large holders
    CandidateCard.tsx                 # Council candidate card
    VoteConfirmDialog.tsx             # Council ballot confirmation modal
    RoleFilter.tsx                    # Council role filter
    ResultsChart.tsx
    proposals/
      ProposalCard.tsx                # List card + SpecialVoteCard (council variant)
      ProposalVoter.tsx               # Voting UI (Yes/No buttons vs radio vs checkbox)
      ProposalResults.tsx             # Bars + pass/fail + quorum + stats + hidden state
      ProposalForm.tsx                # Create/edit form (Identity, Voting, Schedule, Advanced)
      RichTextEditor.tsx              # TipTap WYSIWYG (StarterKit + Link + Image + Placeholder)
      RichTextView.tsx                # Renders server-sanitized TipTap HTML
    charts/ChartSetup.ts              # Chart.js registration and color palette

  hooks/
    useEligibility.ts                 # Loads aurorians + voted state for the connected wallet
    useVote.ts                        # Council ballot signing + submission

  types/
    proposal.ts                       # Proposal, ProposalOption, isYesNoStyle, DEFAULT_OPTIONS
    index.ts                          # Council types (Candidate, AurorianNft, VoteRequest, ...)

supabase/migrations/
  001_initial_schema.sql              # Council: ballots, votes, wallet_delegations, election_settings
  002_proposals.sql                   # Proposals: proposals, proposal_ballots, proposal_votes, tallies view, RPCs

data/
  snapshot.csv                        # Aurorian mint → owner snapshot
  candidates.csv                      # Raw council candidate applications (reference only)
```

## Database

Two independent schemas, parallel patterns. The council tables are untouched by the proposals platform.

### Council Election (migration 001)

| Object | Purpose |
|---|---|
| `ballots` | One row per NFT that voted. `UNIQUE(nft_mint)` prevents double voting. |
| `votes` | One row per (NFT, candidate). Links to `ballots` via FK. |
| `wallet_delegations` | Delegation requests + verifications. `UNIQUE(aurorian_wallet)`, `UNIQUE(tx_signature)`. |
| `election_settings` | Singleton with `show_results` toggle. |
| `vote_tallies` view | Per-candidate vote counts. |
| `submit_ballot()` | Atomic ballot insert (PL/pgSQL, `SECURITY DEFINER`). |

### Proposals Platform (migration 002)

| Object | Purpose |
|---|---|
| `proposals` | Proposal definitions — title, description (sanitized HTML), category, type, options (JSONB), schedule, quorum, threshold, status, creator wallet. |
| `proposal_ballots` | One row per (proposal, NFT). `UNIQUE(proposal_id, nft_mint)` enforces 1-NFT-1-vote. |
| `proposal_votes` | One row per (ballot, option). For `single_choice` = 1 row per ballot; for `multi_choice` = up to `max_choices` rows. |
| `proposal_tallies` view | Per-(proposal, option) vote counts and unique-voter counts. |
| `submit_proposal_ballot()` | Atomic ballot RPC. Validates proposal status + window, optionally deletes prior ballot (vote changes), inserts new. |
| `refresh_proposal_statuses()` | Optional helper to transition `scheduled → active → ended` based on `NOW()`. Call from a cron if desired. |

All tables have RLS enabled. Public reads are allowed (except drafts on `proposals`). All writes go through `submit_proposal_ballot` (service role only) or the API routes (also service role). Direct INSERT/UPDATE/DELETE is blocked by policy.

## Security

- **Signature verification** — every vote and every authoring action requires a wallet signature verified server-side with `tweetnacl`.
- **Snapshot-based eligibility** — the CSV is the source of truth, not on-chain state at vote time.
- **Atomic submission** — PL/pgSQL functions with `UNIQUE` constraints and explicit `EXCEPTION` handling prevent race conditions.
- **RLS lockdown** — all direct writes blocked; only service-role API routes and the `SECURITY DEFINER` RPCs can mutate state.
- **Creator whitelist** — proposal creation/editing is gated on `PROPOSAL_CREATOR_WALLETS` (env var). The server enforces this; the client only uses it for UI hints.
- **HTML sanitization** — TipTap descriptions are sanitized server-side with `sanitize-html` (allowlist of tags + attributes + URL schemes) before persistence. External links are forced `target="_blank" rel="noopener noreferrer nofollow"`.
- **Signed-message hashing** — proposal authoring messages contain a deterministic FNV-1a hash of the payload, so the wallet signs exactly what the server validates.
- **Message freshness** — 5-minute server-side window on all signed messages.
- **Delegation TX verification** — checks sender, recipient, exact amount, TX age, and replay (`UNIQUE(tx_signature)`).
- **Input validation** — wallet and mint addresses parsed as Solana public keys; arrays capped (e.g. 1000 mints per ballot); proposal payloads validated with Zod.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) and run both migrations in order:

```
SQL Editor > New Query > paste supabase/migrations/001_initial_schema.sql > Run
SQL Editor > New Query > paste supabase/migrations/002_proposals.sql      > Run
```

Copy the URL and keys from **Project Settings → API**.

### 2. Helius (NFT metadata)

Sign up at [helius.dev](https://helius.dev) (free tier is enough). Get an API key.

### 3. Environment variables

Copy `.env.local.example` to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NFT metadata + Solana RPC
HELIUS_API_KEY=xxx
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com

# Proposal creators — comma-separated Solana wallet addresses (base58).
# Only these wallets can create / edit / publish / cancel proposals.
PROPOSAL_CREATOR_WALLETS=Wallet1...,Wallet2...,Wallet3...
```

Note: `SOLANA_RPC_URL` is server-only (used for delegation verification). `NEXT_PUBLIC_SOLANA_RPC` is exposed to the client for wallet connection and should not include an API key.

### 4. Run locally

```bash
npm install
npm run dev
```

### 5. Deploy (Heroku)

```bash
heroku create daory-vote
heroku config:set \
  NEXT_PUBLIC_SUPABASE_URL=... \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  HELIUS_API_KEY=... \
  SOLANA_RPC_URL=... \
  NEXT_PUBLIC_SOLANA_RPC=... \
  PROPOSAL_CREATOR_WALLETS=...
git push heroku main
heroku domains:add vote.daory.io
```

## Admin operations

### Adding / removing proposal creators

Edit `PROPOSAL_CREATOR_WALLETS` in your environment and restart the server. The whitelist is parsed once at boot and cached in-process.

### Cancelling or unpublishing a proposal

The creator wallet can hit the **Cancel Proposal** button on the proposal page (a signed `cancel` action). Cancelled proposals stay visible with a banner; tallies are preserved.

To force-remove a proposal entirely, delete the row from `proposals` in Supabase Table Editor — `ON DELETE CASCADE` cleans up its ballots and votes.

### Council Election: toggle results visibility

In Supabase Table Editor, open `election_settings`, edit the row (`id=1`):

- `show_results = false` (default) — public sees participation stats only.
- `show_results = true` — full rankings, elected councillors/advisors, charts.

### Update the council election window

Edit `src/lib/constants.ts`:

```typescript
export const ELECTION_START = new Date("2026-03-30T00:00:00Z");
export const ELECTION_END = new Date("2026-04-06T23:59:59Z");
```

### Update council candidates

Edit `src/lib/candidates.ts`. Each candidate has: `id`, `discordName`, `aurorianNumber`, `imageUrl`, `socials`, `role`, `vision`, `experience`.

### Update the snapshot

Regenerate it from the chain:

```bash
node --env-file=.env scripts/snapshot-core.mjs --verify --resolve-escrow \
  --exclude data/excluded-wallets.csv --out data/snapshot.csv
```

Restart the server — the snapshot is loaded into memory on first request.

Format is `Mint,Owner,Note`. Only the first two columns are read by the app;
`Note` is informational (`syncspace`, `listed:<marketplace>`, `loan:<program>`,
`owner-unresolved`) and safe to ignore or drop.

### Auto-transition proposal statuses (optional)

The app computes effective status from `NOW()` for display purposes, so this is not strictly required. If you want stored status to track wall-clock time (useful for queries and dashboards):

```sql
SELECT refresh_proposal_statuses();
```

Schedule via Supabase Cron or pg_cron to run every few minutes.

## Voting model

### Proposals

- One Aurorian NFT = one ballot per proposal.
- `single_choice` — voter picks exactly one option. Yes/No/Abstain by default; fully editable.
- `multi_choice` — voter picks 1 to `max_choices` options.
- `allow_vote_change = true` — voter can re-sign to change their vote before `ends_at`.
- Pass logic (plurality): the top option must reach `approval_threshold_pct` of total votes. Quorum (`quorum_nfts` or `quorum_pct`) overrides — if not met, the proposal fails regardless.

### Council Election

- One Aurorian NFT = one ballot.
- Each ballot selects up to **5 councillors** (any role bucket) and **3 advisors**.
- Holders with multiple NFTs get proportional power; NFTs weighted equally.
- Once a ballot is submitted, those NFTs cannot vote again in this election.

Candidate images: `https://aurorians.cdn.aurory.io/aurorians-v2/current/images/mini/{number}.png`

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | TailwindCSS 4 (CSS-based `@theme` config, no `tailwind.config.js`) |
| Database | Supabase (PostgreSQL + RLS + SECURITY DEFINER RPCs) |
| Blockchain | Solana Web3.js, Wallet Adapter (Phantom, Solflare, …) |
| NFT metadata | Helius DAS API |
| Rich text | TipTap 3 (StarterKit + Link + Image + Placeholder) |
| HTML safety | sanitize-html (server-side) |
| Validation | Zod |
| Charts | Chart.js 4 + react-chartjs-2 |
| Auth | Wallet signature verification (tweetnacl + bs58) |
| Fonts | Inter (body), Tusker Grotesk 6600 Semibold (headings) |
| Deploy | Heroku (standalone Next.js output) |

## Data files

| File | Description |
|---|---|
| `data/snapshot.csv` | Eligibility snapshot: 8,630 Aurorian Core assets mapped to owner wallets, `Mint,Owner,Note`. Taken August 4, 2026 from the Metaplex Core collection, cross-checked against `getProgramAccounts`. Marketplace/loan escrows are resolved back to the real holder; wallets in `excluded-wallets.csv` are dropped. |
| `data/excluded-wallets.csv` | Wallets removed from the snapshot (DAO treasuries, the v1→v2 redeem address, Aurory team wallets), with the reason for each. |
| `data/snapshot-core.csv` | The same snapshot **before** exclusions (9,999 assets) — audit trail for what was removed. |
| `data/v1-to-core.csv` | Maps legacy v1 Aurorian mints to their Core asset, traced through the June 2024 migration transactions. |
| `data/premint-77-provenance.csv` | Provenance of the 77 Aurorians minted before the public sale: mint time, minter, candy machine, current holder. |
| `data/candidates.csv` | Raw council candidate applications (reference only — parsed data lives in `src/lib/candidates.ts`). |
