"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEligibility } from "@/hooks/useEligibility";
import { useVote } from "@/hooks/useVote";
import { candidates } from "@/lib/candidates";
import { MAX_COUNCILLOR_PICKS, MAX_ADVISOR_PICKS, COUNCILLOR_ROLES } from "@/lib/constants";
import CandidateCard from "@/components/CandidateCard";
import NftSelector from "@/components/NftSelector";
import VoteConfirmDialog from "@/components/VoteConfirmDialog";

export default function VotePage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: eligibility, loading, error: eligibilityError, refetch } = useEligibility();
  const { vote, submitting, error: voteError } = useVote();

  const [selectedMints, setSelectedMints] = useState<string[]>([]);
  const [selectedCouncillors, setSelectedCouncillors] = useState<string[]>([]);
  const [selectedAdvisors, setSelectedAdvisors] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Split candidates by type
  const councillorCandidates = useMemo(
    () => candidates.filter((c) => (COUNCILLOR_ROLES as readonly string[]).includes(c.role)),
    []
  );
  const advisorCandidates = useMemo(
    () => candidates.filter((c) => c.role === "Advisor"),
    []
  );

  const handleToggleMint = (mint: string) => {
    setSelectedMints((prev) =>
      prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint]
    );
  };

  const handleToggleCouncillor = (id: string) => {
    setSelectedCouncillors((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= MAX_COUNCILLOR_PICKS) return prev;
      return [...prev, id];
    });
  };

  const handleToggleAdvisor = (id: string) => {
    setSelectedAdvisors((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= MAX_ADVISOR_PICKS) return prev;
      return [...prev, id];
    });
  };

  const allSelectedCandidates = [...selectedCouncillors, ...selectedAdvisors];
  const canSubmit = selectedMints.length > 0 && allSelectedCandidates.length > 0;

  const handleSubmitBallot = () => {
    if (!canSubmit) return;
    setShowConfirm(true);
  };

  const handleConfirmVote = async () => {
    if (!canSubmit) return;

    const success = await vote(allSelectedCandidates, selectedMints);
    if (success) {
      setShowConfirm(false);
      setSelectedCouncillors([]);
      setSelectedAdvisors([]);
      setSelectedMints([]);
      setSuccessMessage(
        `Ballot submitted! ${selectedMints.length} NFT${selectedMints.length > 1 ? "s" : ""} voted for ${allSelectedCandidates.length} candidates.`
      );
      refetch();
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // State: Not connected
  if (!connected || !publicKey) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-24 text-center">
        <div className="mb-8 sm:mb-12">
          <h1
            className="text-3xl sm:text-5xl lg:text-7xl font-bold uppercase tracking-tight mb-4 sm:mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="text-white">Council</span>
            <br />
            <span className="text-daory-cyan">Election</span>
          </h1>
          <p className="text-lg text-daory-muted max-w-xl mx-auto leading-relaxed">
            Connect your Solana wallet to verify your Aurorian NFTs and cast
            your vote for the next DAOry Council.
          </p>
          <p className="text-sm text-daory-muted mt-3">
            Vote for up to <span className="text-white font-bold">{MAX_COUNCILLOR_PICKS} Councillors</span> and{" "}
            <span className="text-white font-bold">{MAX_ADVISOR_PICKS} Advisors</span>. Each NFT = 1 ballot.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setVisible(true)}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 border border-daory-cyan text-daory-cyan text-sm sm:text-base font-medium uppercase tracking-wider hover:bg-daory-cyan/10 transition-all w-full sm:w-auto justify-center"
          >
            Connect Wallet to Vote
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          <a
            href="/delegate"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 border border-amber-500/60 text-amber-400 text-sm sm:text-base font-medium uppercase tracking-wider hover:bg-amber-500/10 transition-all w-full sm:w-auto justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Delegate Wallet to Vote
          </a>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-px bg-daory-border">
          {[
            { step: "01", title: "Connect Wallet", desc: "Connect your Phantom or Solflare wallet that holds Aurorian NFTs." },
            { step: "02", title: "Pick Candidates", desc: `Select up to ${MAX_COUNCILLOR_PICKS} councillors and ${MAX_ADVISOR_PICKS} advisors.` },
            { step: "03", title: "Sign & Submit", desc: "Sign your ballot with your wallet to cast all votes at once." },
          ].map((item) => (
            <div key={item.step} className="bg-daory-card p-8">
              <span className="text-daory-cyan text-sm font-medium">{item.step}</span>
              <h3
                className="font-bold text-white text-xl mt-2 mb-2 uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {item.title}
              </h3>
              <p className="text-sm text-daory-muted leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // State: Loading / Error / Not eligible (same as before)
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-daory-muted">Checking your wallet for Aurorian NFTs...</p>
      </div>
    );
  }

  if (eligibilityError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="border border-red-800/50 bg-red-900/10 p-6 max-w-md mx-auto">
          <p className="text-red-400 font-semibold mb-2">Error</p>
          <p className="text-red-300/70 text-sm">{eligibilityError}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 border border-daory-border text-white text-sm hover:border-daory-cyan transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-white uppercase mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Not Eligible
        </h1>
        <p className="text-daory-muted max-w-lg mx-auto">
          Your wallet does not hold any Aurorian NFTs from the holder snapshot.
        </p>
        <a href="/results" className="inline-block mt-6 px-6 py-2.5 border border-daory-border text-white text-sm font-medium hover:border-daory-cyan transition-colors uppercase tracking-wider">
          View Results
        </a>
      </div>
    );
  }

  // State: Eligible - Ballot voting UI
  const availableNfts = eligibility?.aurorians.filter((a) => !a.hasVoted).length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success toast */}
      {successMessage && (
        <div className="fixed top-20 right-4 z-50 bg-daory-card border border-daory-cyan/30 p-4 shadow-lg max-w-sm">
          <p className="text-daory-cyan font-medium text-sm">{successMessage}</p>
        </div>
      )}

      {voteError && (
        <div className="mb-6 border border-red-800/50 bg-red-900/10 p-4">
          <p className="text-red-400 text-sm">{voteError}</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white uppercase mb-2" style={{ fontFamily: "var(--font-heading)" }}>
          Cast Your <span className="text-daory-cyan">Ballot</span>
        </h1>
        <p className="text-daory-muted">
          Select your NFTs, pick your councillors and advisors, then submit your ballot.
          {availableNfts > 0 && (
            <span className="text-white font-medium">
              {" "}{availableNfts} NFT{availableNfts !== 1 ? "s" : ""} available.
            </span>
          )}
        </p>
      </div>

      {/* Step 1: NFT Selector */}
      {eligibility && (
        <div className="bg-daory-card border border-daory-border p-4 sm:p-6 mb-8">
          <NftSelector
            aurorians={eligibility.aurorians}
            selectedMints={selectedMints}
            onToggle={handleToggleMint}
            onSelectAll={() => {
              const available = eligibility.aurorians
                .filter((a) => !a.hasVoted)
                .map((a) => a.mint);
              setSelectedMints(available);
            }}
            onDeselectAll={() => setSelectedMints([])}
          />
        </div>
      )}

      {/* Step 2: Councillor Selection */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-2xl font-bold text-white uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Councillors
          </h2>
          <span className={`text-sm font-bold px-3 py-1 border ${
            selectedCouncillors.length >= MAX_COUNCILLOR_PICKS
              ? "border-daory-cyan text-daory-cyan"
              : "border-daory-border text-daory-muted"
          }`}>
            {selectedCouncillors.length} / {MAX_COUNCILLOR_PICKS}
          </span>
        </div>
        <p className="text-sm text-daory-muted mb-4">
          Select up to {MAX_COUNCILLOR_PICKS} councillor candidates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {councillorCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              mode="vote"
              onToggle={() => handleToggleCouncillor(candidate.id)}
              isSelected={selectedCouncillors.includes(candidate.id)}
              disabled={selectedCouncillors.length >= MAX_COUNCILLOR_PICKS}
            />
          ))}
        </div>
      </div>

      {/* Step 3: Advisor Selection */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-2xl font-bold text-white uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Advisors
          </h2>
          <span className={`text-sm font-bold px-3 py-1 border ${
            selectedAdvisors.length >= MAX_ADVISOR_PICKS
              ? "border-amber-500 text-amber-400"
              : "border-daory-border text-daory-muted"
          }`}>
            {selectedAdvisors.length} / {MAX_ADVISOR_PICKS}
          </span>
        </div>
        <p className="text-sm text-daory-muted mb-4">
          Select up to {MAX_ADVISOR_PICKS} advisor candidates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {advisorCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              mode="vote"
              onToggle={() => handleToggleAdvisor(candidate.id)}
              isSelected={selectedAdvisors.includes(candidate.id)}
              disabled={selectedAdvisors.length >= MAX_ADVISOR_PICKS}
            />
          ))}
        </div>
      </div>

      {/* Sticky submit bar */}
      <div className="sticky bottom-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-black/95 backdrop-blur-sm border-t border-daory-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-daory-muted text-center sm:text-left">
            <span className="text-white font-bold">{selectedMints.length}</span> NFT{selectedMints.length !== 1 ? "s" : ""} &middot;{" "}
            <span className="text-daory-cyan font-bold">{selectedCouncillors.length}</span>/{MAX_COUNCILLOR_PICKS} council &middot;{" "}
            <span className="text-amber-400 font-bold">{selectedAdvisors.length}</span>/{MAX_ADVISOR_PICKS} advisors
          </div>
          <button
            onClick={handleSubmitBallot}
            disabled={!canSubmit}
            className={`px-6 py-2.5 font-bold uppercase tracking-wider text-sm transition-all ${
              canSubmit
                ? "bg-daory-cyan text-black hover:bg-daory-cyan-dark"
                : "bg-daory-border text-daory-muted cursor-not-allowed"
            }`}
          >
            Submit Ballot
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && eligibility && (
        <VoteConfirmDialog
          selectedCouncillors={selectedCouncillors}
          selectedAdvisors={selectedAdvisors}
          selectedNfts={eligibility.aurorians.filter((a) =>
            selectedMints.includes(a.mint)
          )}
          onConfirm={handleConfirmVote}
          onCancel={() => setShowConfirm(false)}
          isSubmitting={submitting}
        />
      )}
    </div>
  );
}
