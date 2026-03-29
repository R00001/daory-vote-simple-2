"use client";

import Image from "next/image";
import { candidates } from "@/lib/candidates";
import { VoteTally } from "@/types";

interface ResultsChartProps {
  tallies: VoteTally[];
  totalVotes: number;
}

export default function ResultsChart({ tallies, totalVotes }: ResultsChartProps) {
  const tallyMap = new Map(tallies.map((t) => [t.candidate_id, t.vote_count]));
  const maxVotes = Math.max(...tallies.map((t) => t.vote_count), 1);

  // Group by role
  const roles = [
    "Community & Outreach",
    "Finance & Investment",
    "Infrastructure & Development",
    "Advisor",
    "Unspecified",
  ] as const;

  const ROLE_COLORS: Record<string, string> = {
    "Community & Outreach": "bg-daory-cyan",
    "Finance & Investment": "bg-emerald-500",
    "Infrastructure & Development": "bg-sky-500",
    Advisor: "bg-amber-500",
    Unspecified: "bg-gray-500",
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-3xl font-bold text-daory-text">{totalVotes}</p>
        <p className="text-daory-muted text-sm">Total Votes Cast</p>
      </div>

      {roles.map((role) => {
        const roleCandidates = candidates
          .filter((c) => c.role === role)
          .sort(
            (a, b) =>
              (tallyMap.get(b.id) ?? 0) - (tallyMap.get(a.id) ?? 0)
          );

        if (roleCandidates.length === 0) return null;

        return (
          <div key={role}>
            <h3 className="text-lg font-bold text-daory-text mb-4 flex items-center gap-2">
              <span
                className={`w-3 h-3  ${ROLE_COLORS[role]}`}
              />
              {role}
            </h3>

            <div className="space-y-3">
              {roleCandidates.map((candidate) => {
                const votes = tallyMap.get(candidate.id) ?? 0;
                const percentage =
                  maxVotes > 0 ? (votes / maxVotes) * 100 : 0;

                return (
                  <div
                    key={candidate.id}
                    className="bg-daory-card border border-daory-border  p-3"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative w-10 h-10  overflow-hidden border border-daory-border flex-shrink-0">
                        <Image
                          src={candidate.imageUrl}
                          alt={candidate.discordName}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-daory-text text-sm truncate">
                          {candidate.discordName}
                        </p>
                        <p className="text-xs text-daory-muted">
                          Aurorian #{candidate.aurorianNumber}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-daory-text">
                        {votes}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-daory-bg  overflow-hidden">
                      <div
                        className={`h-full ${ROLE_COLORS[candidate.role]}  transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
