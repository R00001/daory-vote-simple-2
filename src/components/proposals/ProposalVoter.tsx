"use client";

import { useMemo, useState } from "react";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEligibility } from "@/hooks/useEligibility";
import { Proposal, isYesNoStyle } from "@/types/proposal";
import { createProposalVoteMessage } from "@/lib/proposal-message";
import NftSelector from "@/components/NftSelector";
import { isVotingOpen, effectiveStatus, formatCountdown } from "@/lib/proposals";

interface ProposalVoterProps {
  proposal: Proposal;
  votedMints: string[];
  votedOptionIds: string[];
  onVoted: () => void;
}

export default function ProposalVoter({
  proposal,
  votedMints,
  votedOptionIds,
  onVoted,
}: ProposalVoterProps) {
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: eligibility, loading: eligLoading, error: eligError } = useEligibility();

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedMints, setSelectedMints] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const open = isVotingOpen(proposal);
  const status = effectiveStatus(proposal);
  const allowChange = proposal.allow_vote_change;

  // Mark previously-voted mints unavailable unless allow_vote_change is on
  const aurorians = useMemo(() => {
    if (!eligibility?.aurorians) return [];
    const votedSet = new Set(votedMints);
    return eligibility.aurorians.map((a) => ({
      ...a,
      hasVoted: votedSet.has(a.mint) && !allowChange,
    }));
  }, [eligibility?.aurorians, votedMints, allowChange]);

  const toggleOption = (id: string) => {
    if (proposal.type === "single_choice") {
      setSelectedOptions((prev) => (prev[0] === id ? [] : [id]));
      return;
    }
    // multi_choice
    setSelectedOptions((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const max = proposal.max_choices ?? proposal.options.length;
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const yesNoStyle = proposal.type === "single_choice" && isYesNoStyle(proposal.options);

  const canSubmit =
    open && selectedOptions.length > 0 && selectedMints.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !publicKey || !signMessage) return;
    setSubmitting(true);
    setError(null);
    try {
      const timestamp = new Date().toISOString();
      const message = createProposalVoteMessage(
        proposal.slug,
        selectedOptions,
        selectedMints,
        timestamp
      );
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);

      const res = await fetch(`/api/proposals/${proposal.slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          optionIds: selectedOptions,
          mintAddresses: selectedMints,
          signature,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Vote failed");

      setSuccess(
        `Ballot submitted with ${selectedMints.length} NFT${
          selectedMints.length === 1 ? "" : "s"
        }.`
      );
      setSelectedOptions([]);
      setSelectedMints([]);
      onVoted();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ----- States -----
  if (!connected) {
    return (
      <div className="bg-daory-card border border-daory-border p-5 sm:p-6">
        <h3 className="text-base font-bold text-white uppercase mb-2" style={{ fontFamily: "var(--font-heading)" }}>
          Cast Your <span className="text-daory-cyan">Vote</span>
        </h3>
        <p className="text-sm text-daory-muted mb-4">
          Connect a wallet that holds Aurorian NFTs (or is a delegated voting wallet).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setVisible(true)}
            className="flex-1 px-4 py-2.5 border border-daory-cyan text-daory-cyan font-bold uppercase tracking-wider text-sm hover:bg-daory-cyan/10 transition-colors"
          >
            Connect Wallet
          </button>
          <a
            href="/delegate"
            className="flex-1 px-4 py-2.5 border border-amber-500/60 text-amber-400 font-bold uppercase tracking-wider text-sm hover:bg-amber-500/10 transition-colors text-center"
          >
            Delegate Wallet
          </a>
        </div>
      </div>
    );
  }

  if (!open) {
    const label =
      status === "scheduled"
        ? `Voting opens in ${formatCountdown(proposal.starts_at)}`
        : status === "ended"
        ? `Voting ended ${formatCountdown(proposal.ends_at)}`
        : status === "cancelled"
        ? "This proposal was cancelled."
        : "Voting is not open.";
    return (
      <div className="bg-daory-card border border-daory-border p-5 sm:p-6 text-center">
        <p className="text-daory-muted text-sm">{label}</p>
      </div>
    );
  }

  if (eligLoading) {
    return (
      <div className="bg-daory-card border border-daory-border p-5 sm:p-6 text-center">
        <div className="inline-block w-6 h-6 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-daory-muted text-sm">Checking eligibility…</p>
      </div>
    );
  }

  if (eligError) {
    return (
      <div className="border border-red-800/50 bg-red-900/10 p-5 sm:p-6">
        <p className="text-red-400 text-sm">{eligError}</p>
      </div>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="bg-daory-card border border-daory-border p-5 sm:p-6 text-center">
        <p className="text-white font-bold mb-1 uppercase" style={{ fontFamily: "var(--font-heading)" }}>
          Not Eligible
        </p>
        <p className="text-daory-muted text-sm">
          Your wallet does not hold any Aurorian NFTs from the holder snapshot.
        </p>
      </div>
    );
  }

  const availableNfts = aurorians.filter((a) => !a.hasVoted).length;
  const alreadyVoted = votedOptionIds.length > 0;

  return (
    <div className="space-y-5">
      {alreadyVoted && (
        <div className="bg-daory-cyan/5 border border-daory-cyan/30 p-3 text-xs sm:text-sm text-daory-cyan">
          You already voted on this proposal with{" "}
          <span className="font-bold">{votedMints.length}</span> NFT
          {votedMints.length === 1 ? "" : "s"}{" "}
          ({votedOptionIds.join(", ")}).{" "}
          {allowChange
            ? "You can change your vote until the proposal ends."
            : "Your vote is locked."}
        </div>
      )}

      {/* Options */}
      <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3
            className="text-base font-bold text-white uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {proposal.type === "single_choice"
              ? yesNoStyle
                ? "Your Vote"
                : "Pick One"
              : `Pick up to ${proposal.max_choices ?? proposal.options.length}`}
          </h3>
          {proposal.type === "multi_choice" && (
            <span
              className={`text-xs font-bold px-3 py-1 border ${
                selectedOptions.length >= (proposal.max_choices ?? proposal.options.length)
                  ? "border-daory-cyan text-daory-cyan"
                  : "border-daory-border text-daory-muted"
              }`}
            >
              {selectedOptions.length} / {proposal.max_choices ?? proposal.options.length}
            </span>
          )}
        </div>

        {yesNoStyle ? (
          <div className={`grid gap-3 ${proposal.options.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
            {proposal.options.map((opt) => {
              const active = selectedOptions.includes(opt.id);
              const accent =
                opt.id === "yes"
                  ? active
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-daory-border text-daory-muted hover:border-emerald-500/60 hover:text-emerald-400"
                  : opt.id === "no"
                  ? active
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-daory-border text-daory-muted hover:border-red-500/60 hover:text-red-400"
                  : active
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-daory-border text-daory-muted hover:border-amber-500/60 hover:text-amber-400";
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`border-2 py-4 sm:py-6 font-bold uppercase tracking-wider text-base sm:text-lg transition-colors ${accent}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {proposal.options.map((opt) => {
              const active = selectedOptions.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`w-full text-left px-4 py-3 border transition-colors flex items-center gap-3 ${
                    active
                      ? "border-daory-cyan bg-daory-cyan/5"
                      : "border-daory-border hover:border-daory-border-hover"
                  }`}
                >
                  <span
                    className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${
                      proposal.type === "single_choice" ? "rounded-full" : ""
                    } ${active ? "border-daory-cyan bg-daory-cyan" : "border-daory-border"}`}
                  >
                    {active && (
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-medium ${active ? "text-white" : "text-daory-muted"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* NFT selector */}
      {eligibility && (
        <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
          <NftSelector
            aurorians={aurorians}
            selectedMints={selectedMints}
            onToggle={(mint) => {
              setSelectedMints((prev) =>
                prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint]
              );
            }}
            onSelectAll={() => {
              const available = aurorians.filter((a) => !a.hasVoted).map((a) => a.mint);
              setSelectedMints(available);
            }}
            onDeselectAll={() => setSelectedMints([])}
          />
        </div>
      )}

      {/* Errors / success */}
      {error && (
        <div className="border border-red-800/50 bg-red-900/10 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="border border-daory-cyan/30 bg-daory-cyan/5 p-3">
          <p className="text-daory-cyan text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Sticky submit */}
      <div className="sticky bottom-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-0 bg-black/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none border-t border-daory-border sm:border-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-daory-muted">
            <span className="text-white font-bold">{selectedMints.length}</span> NFT
            {selectedMints.length !== 1 ? "s" : ""} &middot;{" "}
            <span className="text-daory-cyan font-bold">{selectedOptions.length}</span>{" "}
            option{selectedOptions.length !== 1 ? "s" : ""} selected
            {availableNfts > 0 && (
              <span className="text-daory-muted">
                {" "}&middot; {availableNfts} available
              </span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-6 py-2.5 font-bold uppercase tracking-wider text-sm transition-colors ${
              canSubmit
                ? "bg-daory-cyan text-black hover:bg-daory-cyan-dark"
                : "bg-daory-border text-daory-muted cursor-not-allowed"
            }`}
          >
            {submitting ? "Signing…" : alreadyVoted && allowChange ? "Update Vote" : "Sign & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
