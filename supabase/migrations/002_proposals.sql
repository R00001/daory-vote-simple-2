-- ============================================
-- DAOry Vote - Proposals Platform
-- Migration 002: Adds generalized proposal voting
-- on top of the existing council election schema.
-- ============================================

-- ============================================
-- Proposals
-- ============================================
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT NOT NULL DEFAULT '',          -- TipTap HTML (server-sanitized before insert)
  category TEXT NOT NULL CHECK (category IN (
    'Treasury','Governance','Community','Marketing','Partnership','Other'
  )),
  discussion_url TEXT,

  -- Vote shape
  type TEXT NOT NULL CHECK (type IN ('single_choice','multi_choice')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{"id":"yes","label":"Yes"}, ...]
  max_choices INT,                               -- only for multi_choice
  allow_vote_change BOOLEAN NOT NULL DEFAULT TRUE,

  -- Window
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  discussion_period_hours INT NOT NULL DEFAULT 0,

  -- Validity rules
  quorum_nfts INT,                               -- minimum NFTs that must vote
  quorum_pct NUMERIC(5,2),                       -- alternative: % of snapshot
  approval_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  binding BOOLEAN NOT NULL DEFAULT FALSE,

  -- Transparency
  show_results_during BOOLEAN NOT NULL DEFAULT TRUE,
  show_voter_list BOOLEAN NOT NULL DEFAULT TRUE,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','scheduled','active','ended','cancelled'
  )),
  cancelled_reason TEXT,

  creator_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_window CHECK (ends_at > starts_at),
  CONSTRAINT valid_threshold CHECK (approval_threshold_pct >= 0 AND approval_threshold_pct <= 100),
  CONSTRAINT valid_quorum_pct CHECK (quorum_pct IS NULL OR (quorum_pct >= 0 AND quorum_pct <= 100)),
  CONSTRAINT valid_max_choices CHECK (
    type <> 'multi_choice' OR (max_choices IS NOT NULL AND max_choices >= 1)
  )
);

CREATE INDEX idx_proposals_status     ON proposals(status);
CREATE INDEX idx_proposals_starts_at  ON proposals(starts_at);
CREATE INDEX idx_proposals_ends_at    ON proposals(ends_at);
CREATE INDEX idx_proposals_creator    ON proposals(creator_wallet);
CREATE INDEX idx_proposals_category   ON proposals(category);

CREATE OR REPLACE FUNCTION touch_proposal_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proposals_updated_at
BEFORE UPDATE ON proposals
FOR EACH ROW EXECUTE FUNCTION touch_proposal_updated_at();

-- ============================================
-- Proposal Ballots
-- One ballot per (proposal, NFT). Re-voting (if allow_vote_change)
-- deletes the prior ballot and re-inserts inside submit_proposal_ballot().
-- ============================================
CREATE TABLE proposal_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  nft_mint TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proposal_id, nft_mint)
);

CREATE INDEX idx_proposal_ballots_proposal ON proposal_ballots(proposal_id);
CREATE INDEX idx_proposal_ballots_voter    ON proposal_ballots(voter_wallet);

-- ============================================
-- Proposal Votes
-- One row per (ballot, option). For binary/single_choice = exactly one row
-- per ballot. For multi_choice = up to max_choices rows per ballot.
-- ============================================
CREATE TABLE proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES proposal_ballots(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  nft_mint TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ballot_id, option_id)
);

CREATE INDEX idx_proposal_votes_proposal  ON proposal_votes(proposal_id);
CREATE INDEX idx_proposal_votes_option    ON proposal_votes(proposal_id, option_id);
CREATE INDEX idx_proposal_votes_voter     ON proposal_votes(voter_wallet);

-- Aggregated tallies per proposal/option.
-- security_invoker=on so the view respects RLS of the querying role
-- (Postgres views default to SECURITY DEFINER, which bypasses RLS).
CREATE VIEW proposal_tallies
WITH (security_invoker = on) AS
SELECT
  proposal_id,
  option_id,
  COUNT(*) AS vote_count,
  COUNT(DISTINCT voter_wallet) AS unique_voters
FROM proposal_votes
GROUP BY proposal_id, option_id;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Drafts are NOT publicly readable.
-- Cancelled, scheduled, active, ended are all visible.
CREATE POLICY "Public read non-draft proposals" ON proposals
  FOR SELECT USING (status <> 'draft');

CREATE POLICY "No direct insert proposals" ON proposals FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update proposals" ON proposals FOR UPDATE USING (false);
CREATE POLICY "No direct delete proposals" ON proposals FOR DELETE USING (false);

ALTER TABLE proposal_ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read proposal ballots" ON proposal_ballots FOR SELECT USING (true);
CREATE POLICY "No direct insert proposal ballots" ON proposal_ballots FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update proposal ballots" ON proposal_ballots FOR UPDATE USING (false);
CREATE POLICY "No direct delete proposal ballots" ON proposal_ballots FOR DELETE USING (false);

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read proposal votes" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "No direct insert proposal votes" ON proposal_votes FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update proposal votes" ON proposal_votes FOR UPDATE USING (false);
CREATE POLICY "No direct delete proposal votes" ON proposal_votes FOR DELETE USING (false);

-- ============================================
-- Atomic ballot submission
-- ============================================
CREATE OR REPLACE FUNCTION submit_proposal_ballot(
  p_proposal_id UUID,
  p_nft_mints TEXT[],
  p_voter_wallet TEXT,
  p_signature TEXT,
  p_option_ids TEXT[],
  p_allow_change BOOLEAN
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ballot_id UUID;
  v_mint TEXT;
  v_option TEXT;
  v_count INT := 0;
  v_status TEXT;
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
BEGIN
  -- Validate proposal exists, is open, and window is valid.
  SELECT status, starts_at, ends_at
    INTO v_status, v_starts, v_ends
  FROM proposals WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Proposal not found');
  END IF;
  IF v_status NOT IN ('active','scheduled') THEN
    RETURN json_build_object('success', false, 'error', 'Proposal is not open for voting');
  END IF;
  IF NOW() < v_starts THEN
    RETURN json_build_object('success', false, 'error', 'Voting has not started yet');
  END IF;
  IF NOW() > v_ends THEN
    RETURN json_build_object('success', false, 'error', 'Voting has ended');
  END IF;

  FOREACH v_mint IN ARRAY p_nft_mints LOOP
    IF p_allow_change THEN
      DELETE FROM proposal_ballots
        WHERE proposal_id = p_proposal_id AND nft_mint = v_mint;
    END IF;

    INSERT INTO proposal_ballots (proposal_id, nft_mint, voter_wallet, signature)
    VALUES (p_proposal_id, v_mint, p_voter_wallet, p_signature)
    RETURNING id INTO v_ballot_id;

    FOREACH v_option IN ARRAY p_option_ids LOOP
      INSERT INTO proposal_votes (ballot_id, proposal_id, nft_mint, voter_wallet, option_id)
      VALUES (v_ballot_id, p_proposal_id, v_mint, p_voter_wallet, v_option);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object('success', true, 'votes_recorded', v_count);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error',
      'One or more NFTs have already voted on this proposal');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_proposal_ballot FROM public, anon, authenticated;

-- ============================================
-- Optional: server-driven status transition
-- (call from a cron or admin script; not exposed publicly)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_proposal_statuses()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed INT := 0;
BEGIN
  UPDATE proposals
    SET status = 'active'
  WHERE status = 'scheduled' AND starts_at <= NOW() AND ends_at > NOW();
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  UPDATE proposals
    SET status = 'ended'
  WHERE status IN ('active','scheduled') AND ends_at <= NOW();

  RETURN v_changed;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_proposal_statuses FROM public, anon, authenticated;
