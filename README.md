# DAOry Vote

On-chain voting system for the DAOry Council Election. Aurorian NFT holders cast ballots to elect **5 Councillors** and **3 Advisors**.

Built with Next.js, Supabase, Solana wallet adapters, and Chart.js.

## How It Works

1. **Holder connects wallet** (Phantom, Solflare, etc.)
2. **System verifies eligibility** against the NFT holder snapshot (9,997 Aurorians)
3. **Voter selects up to 5 councillor candidates and 3 advisors**
4. **Signs a ballot message** with their wallet (no transaction, just a signature)
5. **Ballot is recorded** in Supabase - each NFT can only vote once

Voters who don't want to connect their holder wallet can use the **Wallet Delegation** system instead.

## Wallet Delegation

For holders who prefer not to connect their Aurorian wallet to a web app:

1. Enter your Aurorian wallet address and a separate voting wallet address
2. System generates a unique micro-SOL amount (e.g., `0.0000541823 SOL`)
3. Send that exact amount from your Aurorian wallet to your voting wallet using your own wallet app
4. Paste the transaction signature to verify
5. Connect the voting wallet on the Vote page to cast your ballot

The Aurorian wallet never connects to this site. Ownership is proven by the on-chain transfer.

## Architecture

```
src/
  app/
    page.tsx                    # Main voting page (ballot selection)
    results/page.tsx            # Results dashboard with charts
    delegate/page.tsx           # Wallet delegation flow
    api/
      eligibility/route.ts      # Check wallet against snapshot, return NFTs
      vote/route.ts             # Submit ballot (signature verification + DB)
      results/route.ts          # Fetch tallies (respects show_results toggle)
      delegate/
        request/route.ts        # Generate verification amount
        verify/route.ts         # Verify on-chain transfer

  lib/
    ballot.ts                   # Ballot message creation (shared client/server)
    candidates.ts               # Hardcoded candidate data from CSV
    constants.ts                # Election rules (seats, dates, roles)
    helius.ts                   # Helius DAS API for NFT metadata
    snapshot.ts                 # CSV snapshot loaded into memory Maps
    supabase.ts                 # Read client (anon) + Admin client (service role)
    verify-signature.ts         # tweetnacl signature verification

  components/
    CandidateCard.tsx           # Candidate display with toggle selection
    NftSelector.tsx             # NFT grid with compact mode for large holders
    VoteConfirmDialog.tsx       # Ballot confirmation modal
    DelegateWallet.tsx          # Delegation step-by-step flow
    Header.tsx                  # Navigation with DAOry logo
    charts/ChartSetup.ts        # Chart.js registration and color palette
```

## Database Schema

Four tables + one view + one function:

| Table | Purpose |
|-------|---------|
| `ballots` | One row per NFT that voted. `UNIQUE(nft_mint)` prevents double voting. |
| `votes` | One row per (NFT, candidate) pair. Links to `ballots` via FK. |
| `wallet_delegations` | Delegation requests and verifications. `UNIQUE(aurorian_wallet)`. |
| `election_settings` | Singleton row with `show_results` toggle. |
| `vote_tallies` (view) | `SELECT candidate_id, COUNT(*) FROM votes GROUP BY candidate_id` |
| `submit_ballot()` (function) | Atomic PL/pgSQL function that inserts ballot + votes in one transaction. |

All tables have RLS enabled. All writes go through the service role (API routes only). The `submit_ballot` function has `REVOKE EXECUTE FROM public, anon, authenticated`.

Full schema: [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)

## Security

- **Signature verification**: Every vote requires a wallet signature verified server-side with `tweetnacl`
- **Snapshot-based eligibility**: The CSV snapshot is the source of truth, not on-chain state at vote time
- **Atomic ballot submission**: PL/pgSQL function with `UNIQUE` constraints prevents race conditions
- **RLS everywhere**: All tables block direct INSERT/UPDATE/DELETE. Only the service role can write.
- **Delegation TX verification**: Checks sender, recipient, exact amount, TX age (< 1 hour), and TX replay (UNIQUE signature)
- **Election window**: Voting only accepted between `ELECTION_START` and `ELECTION_END`
- **Input validation**: All wallet addresses validated as Solana public keys, array length limits enforced

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then run the migration SQL:

```
SQL Editor > New Query > Paste contents of supabase/migrations/001_initial_schema.sql > Run
```

Copy your keys from Project Settings > API.

### 2. Helius (NFT Metadata)

Sign up at [helius.dev](https://helius.dev) (free tier available). Get an API key.

### 3. Environment Variables

Copy `.env.local.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HELIUS_API_KEY=xxx
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

Note: `SOLANA_RPC_URL` (server-only, for delegation verification) vs `NEXT_PUBLIC_SOLANA_RPC` (client, for wallet connection - no API key).

### 4. Run Locally

```bash
npm install
npm run dev
```

### 5. Deploy (Heroku)

```bash
heroku create daory-vote
heroku config:set NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... HELIUS_API_KEY=... SOLANA_RPC_URL=... NEXT_PUBLIC_SOLANA_RPC=...
git push heroku main
heroku domains:add vote.daory.io
```

## Admin Operations

### Toggle Results Visibility

In Supabase Table Editor, go to `election_settings`, edit the row (id=1):

- `show_results = false` (default): public sees participation stats only (ballots cast, %, unique voters) with a locked screen
- `show_results = true`: full results dashboard with rankings, elected councillors/advisors, charts

### Update Election Window

Edit `src/lib/constants.ts`:

```typescript
export const ELECTION_START = new Date("2026-03-30T00:00:00Z");
export const ELECTION_END = new Date("2026-04-06T23:59:59Z");
```

### Update Candidates

Edit `src/lib/candidates.ts`. Each candidate has: `id`, `discordName`, `aurorianNumber`, `imageUrl`, `socials`, `role`, `vision`, `experience`.

### Update Snapshot

Replace `data/snapshot.csv` (format: `Mint,Owner`). Restart the server - the snapshot is loaded into memory on first request.

## Data Files

| File | Description |
|------|-------------|
| `data/snapshot.csv` | 9,997 Aurorian NFT mint addresses mapped to owner wallets. Taken March 24, 2025. |
| `data/candidates.csv` | Raw candidate applications (reference only, parsed data is in `src/lib/candidates.ts`). |

## Voting Model

- Each Aurorian NFT = 1 ballot
- Each ballot selects up to **5 councillors** and **3 advisors**
- Holders with multiple NFTs get proportional voting power
- NFTs are weighted equally (1 NFT = 1 vote per candidate)
- Once a ballot is submitted, those NFTs cannot vote again

Candidate images: `https://aurorians.cdn.aurory.io/aurorians-v2/current/images/mini/{number}.png`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS 4 |
| Database | Supabase (PostgreSQL + RLS + RPC functions) |
| Blockchain | Solana Web3.js, Wallet Adapter (Phantom, Solflare) |
| NFT Data | Helius DAS API |
| Charts | Chart.js + react-chartjs-2 |
| Auth | Wallet signature verification (tweetnacl + bs58) |
| Fonts | Inter (body), Tusker Grotesk 6600 Semibold (headings) |
| Deploy | Heroku (standalone output) |
