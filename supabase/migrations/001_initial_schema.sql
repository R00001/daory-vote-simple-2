-- ============================================
-- DAOry Vote - Database Schema
-- ============================================

-- Ballots table: one ballot per NFT (prevents race condition double-voting)
CREATE TABLE ballots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nft_mint TEXT NOT NULL UNIQUE,        -- 1 ballot per NFT enforced at DB level
  voter_wallet TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ballots_voter_wallet ON ballots(voter_wallet);

-- Votes table: individual candidate votes within a ballot
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  nft_mint TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nft_mint, candidate_id)
);

CREATE INDEX idx_votes_candidate_id ON votes(candidate_id);
CREATE INDEX idx_votes_nft_mint ON votes(nft_mint);
CREATE INDEX idx_votes_ballot_id ON votes(ballot_id);

-- Vote tallies view (counts per-NFT votes per candidate)
CREATE VIEW vote_tallies AS
SELECT candidate_id, COUNT(*) as vote_count
FROM votes GROUP BY candidate_id;

-- RLS: ballots
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ballots" ON ballots FOR SELECT USING (true);
CREATE POLICY "No direct insert ballots" ON ballots FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update ballots" ON ballots FOR UPDATE USING (false);
CREATE POLICY "No direct delete ballots" ON ballots FOR DELETE USING (false);

-- RLS: votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);
CREATE POLICY "No direct insert votes" ON votes FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update votes" ON votes FOR UPDATE USING (false);
CREATE POLICY "No direct delete votes" ON votes FOR DELETE USING (false);

-- ============================================
-- Wallet Delegations
-- ============================================

CREATE TABLE wallet_delegations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aurorian_wallet TEXT NOT NULL,
  voting_wallet TEXT NOT NULL,
  verification_lamports BIGINT NOT NULL,   -- stored as integer lamports (no floating point)
  verified BOOLEAN DEFAULT FALSE,
  tx_signature TEXT UNIQUE,                -- prevent TX replay
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(aurorian_wallet)
);

CREATE INDEX idx_delegations_voting_wallet ON wallet_delegations(voting_wallet);

-- RLS: delegations
ALTER TABLE wallet_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read delegations" ON wallet_delegations FOR SELECT USING (true);
CREATE POLICY "No direct insert delegations" ON wallet_delegations FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update delegations" ON wallet_delegations FOR UPDATE USING (false);
CREATE POLICY "No direct delete delegations" ON wallet_delegations FOR DELETE USING (false);

-- ============================================
-- Server-side function for atomic ballot submission
-- ============================================

CREATE OR REPLACE FUNCTION submit_ballot(
  p_nft_mints TEXT[],
  p_voter_wallet TEXT,
  p_signature TEXT,
  p_candidate_ids TEXT[]
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ballot_id UUID;
  v_mint TEXT;
  v_candidate TEXT;
  v_count INT := 0;
BEGIN
  -- Insert ballots for each NFT (UNIQUE constraint serializes concurrent attempts)
  FOREACH v_mint IN ARRAY p_nft_mints LOOP
    INSERT INTO ballots (nft_mint, voter_wallet, signature)
    VALUES (v_mint, p_voter_wallet, p_signature)
    RETURNING id INTO v_ballot_id;

    -- Insert a vote row for each candidate
    FOREACH v_candidate IN ARRAY p_candidate_ids LOOP
      INSERT INTO votes (ballot_id, nft_mint, voter_wallet, candidate_id)
      VALUES (v_ballot_id, v_mint, p_voter_wallet, v_candidate);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object('success', true, 'votes_recorded', v_count);
EXCEPTION
  WHEN unique_violation THEN
    -- PL/pgSQL automatically rolls back all inserts in this block on exception
    RETURN json_build_object('success', false, 'error', 'One or more NFTs have already submitted a ballot');
END;
$$;

-- CRITICAL: Revoke execute from public/anon/authenticated roles.
-- Only service_role (used by API routes) can call this function.
REVOKE EXECUTE ON FUNCTION submit_ballot FROM public, anon, authenticated;

-- ============================================
-- Election Settings (admin-controlled via Supabase dashboard)
-- ============================================

CREATE TABLE election_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton row
  show_results BOOLEAN DEFAULT FALSE,            -- flip to TRUE to reveal results
  election_name TEXT DEFAULT 'DAOry Council Election 2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the singleton row
INSERT INTO election_settings (id, show_results) VALUES (1, false);

-- RLS: anyone can read settings, no one can write (use Supabase dashboard)
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON election_settings FOR SELECT USING (true);
CREATE POLICY "No direct insert settings" ON election_settings FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update settings" ON election_settings FOR UPDATE USING (false);
CREATE POLICY "No direct delete settings" ON election_settings FOR DELETE USING (false);
