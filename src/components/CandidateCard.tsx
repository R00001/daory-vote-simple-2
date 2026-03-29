"use client";

import Image from "next/image";
import { Candidate } from "@/types";
import { useState } from "react";

const ROLE_BADGE_COLORS: Record<string, string> = {
  "Community & Outreach": "bg-daory-cyan/20 text-daory-cyan",
  "Finance & Investment": "bg-emerald-600/20 text-emerald-400",
  "Infrastructure & Development": "bg-sky-600/20 text-sky-400",
  Advisor: "bg-amber-600/20 text-amber-400",
  Unspecified: "bg-daory-muted/20 text-daory-muted",
};

interface CandidateCardProps {
  candidate: Candidate;
  voteCount?: number;
  onToggle?: () => void;
  isSelected?: boolean;
  disabled?: boolean;
  mode?: "vote" | "results";
}

export default function CandidateCard({
  candidate,
  voteCount,
  onToggle,
  isSelected,
  disabled,
  mode = "vote",
}: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-daory-card border overflow-hidden transition-all ${
        isSelected
          ? "border-daory-cyan shadow-lg shadow-daory-cyan/20"
          : "border-daory-border hover:border-daory-border-hover"
      }`}
    >
      {/* Header with avatar */}
      <div className="flex items-center gap-4 p-4 pb-3">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 overflow-hidden border border-daory-border flex-shrink-0">
          <Image
            src={candidate.imageUrl}
            alt={`Aurorian #${candidate.aurorianNumber}`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg text-white truncate">
            {candidate.discordName}
          </h3>
          <p className="text-daory-muted text-sm">
            Aurorian #{candidate.aurorianNumber}
          </p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold ${
              ROLE_BADGE_COLORS[candidate.role]
            }`}
          >
            {candidate.role}
          </span>
        </div>
        {/* Selection indicator for vote mode */}
        {mode === "vote" && onToggle && (
          <button
            onClick={onToggle}
            disabled={disabled && !isSelected}
            className={`w-8 h-8 flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              isSelected
                ? "border-daory-cyan bg-daory-cyan"
                : disabled
                ? "border-daory-border cursor-not-allowed opacity-30"
                : "border-daory-border hover:border-daory-cyan"
            }`}
          >
            {isSelected && (
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Vision */}
      <div className="px-4 pb-3">
        <p
          className={`text-sm text-daory-muted leading-relaxed ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {candidate.vision}
        </p>
        {candidate.vision.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-daory-cyan hover:underline mt-1"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Socials */}
      {candidate.socials && (
        <div className="px-4 pb-3">
          <a
            href={
              candidate.socials.startsWith("http")
                ? candidate.socials
                : `https://x.com/${candidate.socials}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-daory-cyan hover:underline"
          >
            {candidate.socials.includes("x.com") || candidate.socials.includes("twitter")
              ? "X/Twitter"
              : candidate.socials.includes("youtube")
              ? "YouTube"
              : candidate.socials.includes("linkedin")
              ? "LinkedIn"
              : "Social"}
          </a>
        </div>
      )}

      {/* Footer */}
      {mode === "results" && voteCount !== undefined && (
        <div className="px-4 py-3 border-t border-daory-border">
          <span className="text-sm text-daory-muted">
            <span className="text-white font-bold">{voteCount}</span> votes
          </span>
        </div>
      )}
    </div>
  );
}
