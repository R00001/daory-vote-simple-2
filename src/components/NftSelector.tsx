"use client";

import Image from "next/image";
import { AurorianNft } from "@/types";
import { useState, useMemo } from "react";
import { candidates } from "@/lib/candidates";

const COMPACT_THRESHOLD = 50; // Switch to compact mode above this count
const GRID_PAGE_SIZE = 60;    // Show N at a time in expanded grid view

interface NftSelectorProps {
  aurorians: AurorianNft[];
  selectedMints: string[];
  onToggle: (mint: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function NftSelector({
  aurorians,
  selectedMints,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: NftSelectorProps) {
  const available = useMemo(() => aurorians.filter((a) => !a.hasVoted), [aurorians]);
  const voted = useMemo(() => aurorians.filter((a) => a.hasVoted), [aurorians]);
  const selectedSet = useMemo(() => new Set(selectedMints), [selectedMints]);

  const allAvailableSelected =
    available.length > 0 && available.every((a) => selectedSet.has(a.mint));

  const isLargeCollection = aurorians.length > COMPACT_THRESHOLD;
  const [viewMode, setViewMode] = useState<"compact" | "grid">(
    isLargeCollection ? "compact" : "grid"
  );
  const [gridPage, setGridPage] = useState(1);
  const [hoveredMint, setHoveredMint] = useState<string | null>(null);

  const visibleNfts =
    viewMode === "grid"
      ? aurorians.slice(0, gridPage * GRID_PAGE_SIZE)
      : [];
  const hasMore = viewMode === "grid" && visibleNfts.length < aurorians.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white">
          Your Aurorians{" "}
          <span className="text-daory-muted font-normal text-sm">
            ({available.length} available, {voted.length} voted)
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {isLargeCollection && (
            <button
              onClick={() => setViewMode(viewMode === "compact" ? "grid" : "compact")}
              className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider border border-daory-border text-daory-muted hover:text-white hover:border-daory-border-hover transition-colors"
            >
              {viewMode === "compact" ? "Show Grid" : "Compact"}
            </button>
          )}
          {available.length > 1 && (
            <button
              onClick={allAvailableSelected ? onDeselectAll : onSelectAll}
              className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider border border-daory-border text-daory-muted hover:text-daory-cyan hover:border-daory-cyan transition-colors"
            >
              {allAvailableSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
      </div>

      {available.length === 0 && (
        <p className="text-daory-muted text-sm">
          All your Aurorians have already voted.
        </p>
      )}

      {/* Compact mode: summary cards instead of individual thumbnails */}
      {viewMode === "compact" && (
        <div className="space-y-3">
          {/* Selection summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-daory-border">
            <div className="bg-daory-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
                Total NFTs
              </div>
              <div className="text-2xl font-bold text-white">{aurorians.length}</div>
            </div>
            <div className="bg-daory-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
                Selected
              </div>
              <div className="text-2xl font-bold text-daory-cyan">
                {selectedMints.length}
              </div>
            </div>
            <div className="bg-daory-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1">
                Already Voted
              </div>
              <div className="text-2xl font-bold text-daory-muted">{voted.length}</div>
            </div>
          </div>

          {/* Quick select bar */}
          <div className="flex items-center justify-between bg-white/[0.02] border border-daory-border p-3">
            <p className="text-sm text-daory-muted">
              {allAvailableSelected ? (
                <>
                  All <span className="text-daory-cyan font-bold">{available.length}</span> available
                  NFTs selected
                </>
              ) : selectedMints.length > 0 ? (
                <>
                  <span className="text-daory-cyan font-bold">{selectedMints.length}</span> of{" "}
                  {available.length} available NFTs selected
                </>
              ) : (
                "No NFTs selected. Use Select All or switch to Grid view."
              )}
            </p>
          </div>

          {/* Show a small preview of first few NFTs if metadata available */}
          {aurorians[0]?.hasMetadata !== false && (
            <div className="flex gap-1 overflow-hidden">
              {aurorians.slice(0, 12).map((nft) => (
                <div key={nft.mint} className="relative w-10 h-10 flex-shrink-0 border border-daory-border overflow-hidden">
                  {nft.imageUrl ? (
                    <Image src={nft.imageUrl} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full bg-daory-card" />
                  )}
                </div>
              ))}
              {aurorians.length > 12 && (
                <div className="w-10 h-10 flex-shrink-0 border border-daory-border bg-daory-card flex items-center justify-center">
                  <span className="text-[10px] text-daory-muted">+{aurorians.length - 12}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid mode: individual NFT thumbnails (paginated) */}
      {viewMode === "grid" && (
        <>
          <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto p-1">
            {visibleNfts.map((nft) => {
              const isSelected = selectedSet.has(nft.mint);
              const isVoted = nft.hasVoted;
              const hasImage = nft.imageUrl && nft.hasMetadata !== false;

              return (
                <div key={nft.mint} className="relative">
                  <button
                    onClick={() => !isVoted && onToggle(nft.mint)}
                    onMouseEnter={() => setHoveredMint(nft.mint)}
                    onMouseLeave={() => setHoveredMint(null)}
                    disabled={isVoted}
                    className={`relative group overflow-hidden border-2 transition-all ${
                      isVoted
                        ? "border-daory-border opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-daory-cyan shadow-daory-cyan/30 shadow-sm"
                        : "border-daory-border hover:border-daory-cyan/50"
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 relative">
                      {hasImage ? (
                        <Image
                          src={nft.imageUrl}
                          alt={`#${nft.number}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-daory-card flex items-center justify-center">
                          <span className="text-[10px] text-daory-muted font-mono">
                            {nft.mint.slice(0, 4)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center">
                      <span className="text-[10px] font-bold text-white">
                        {nft.number > 0 ? `#${nft.number}` : "NFT"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-daory-cyan flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {isVoted && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-daory-muted">VOTED</span>
                      </div>
                    )}
                  </button>

                  {/* Tooltip */}
                  {hoveredMint === nft.mint && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
                      <div className="bg-black border border-daory-border px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                        {nft.number > 0 && <p className="font-bold text-white">Aurorian #{nft.number}</p>}
                        <p className="text-daory-muted font-mono text-[10px] mt-0.5">
                          {nft.mint.slice(0, 12)}...{nft.mint.slice(-8)}
                        </p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-daory-border" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setGridPage((p) => p + 1)}
              className="mt-3 w-full py-2 text-xs font-medium uppercase tracking-wider border border-daory-border text-daory-muted hover:text-white hover:border-daory-border-hover transition-colors"
            >
              Show more ({aurorians.length - visibleNfts.length} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
