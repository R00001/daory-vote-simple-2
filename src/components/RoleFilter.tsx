"use client";

import { ROLES } from "@/lib/candidates";

interface RoleFilterProps {
  selected: string;
  onSelect: (role: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  All: "bg-daory-cyan",
  "Community & Outreach": "bg-daory-cyan",
  "Finance & Investment": "bg-emerald-600",
  "Infrastructure & Development": "bg-sky-600",
  Advisor: "bg-amber-600",
  Unspecified: "bg-daory-muted",
};

export default function RoleFilter({ selected, onSelect }: RoleFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((role) => {
        const isActive = selected === role;
        return (
          <button
            key={role}
            onClick={() => onSelect(role)}
            className={`px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all ${
              isActive
                ? "border border-daory-cyan text-daory-cyan"
                : "border border-daory-border text-daory-muted hover:text-white hover:border-daory-border-hover"
            }`}
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}
