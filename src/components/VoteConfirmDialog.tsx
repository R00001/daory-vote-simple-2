"use client";

import { candidates } from "@/lib/candidates";
import { AurorianNft } from "@/types";

interface VoteConfirmDialogProps {
  selectedCouncillors: string[];
  selectedAdvisors: string[];
  selectedNfts: AurorianNft[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function VoteConfirmDialog({
  selectedCouncillors,
  selectedAdvisors,
  selectedNfts,
  onConfirm,
  onCancel,
  isSubmitting,
}: VoteConfirmDialogProps) {
  const councillorNames = selectedCouncillors
    .map((id) => candidates.find((c) => c.id === id)?.discordName)
    .filter(Boolean);
  const advisorNames = selectedAdvisors
    .map((id) => candidates.find((c) => c.id === id)?.discordName)
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-daory-card border border-daory-border p-4 sm:p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2
          className="text-xl sm:text-2xl font-bold text-white mb-4 uppercase"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Confirm Your <span className="text-daory-cyan">Ballot</span>
        </h2>

        <div className="space-y-4">
          {/* NFTs */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
              Voting with {selectedNfts.length} NFT{selectedNfts.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedNfts.map((nft) => (
                <span
                  key={nft.mint}
                  className="px-2 py-0.5 bg-black text-xs font-semibold text-white"
                >
                  {nft.number > 0 ? `#${nft.number}` : nft.mint.slice(0, 6) + "..."}
                </span>
              ))}
            </div>
          </div>

          {/* Councillors */}
          {councillorNames.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
                Councillors ({councillorNames.length})
              </p>
              <div className="space-y-1">
                {councillorNames.map((name) => (
                  <p key={name} className="text-sm font-bold text-daory-cyan">
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Advisors */}
          {advisorNames.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
                Advisors ({advisorNames.length})
              </p>
              <div className="space-y-1">
                {advisorNames.map((name) => (
                  <p key={name} className="text-sm font-bold text-amber-400">
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-900/10 border border-amber-700/30 p-3">
            <p className="text-xs text-amber-300">
              This action cannot be undone. Each Aurorian NFT can only submit one ballot.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 sm:py-2.5 border border-daory-border text-daory-muted hover:text-white hover:border-daory-cyan transition-colors font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-daory-cyan text-black font-bold hover:bg-daory-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? "Signing..." : "Sign & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
