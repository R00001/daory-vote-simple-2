"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Bar, Doughnut } from "react-chartjs-2";
import "@/components/charts/ChartSetup";
import { CHART_COLORS, SCALE_DEFAULTS } from "@/components/charts/ChartSetup";
import { candidates } from "@/lib/candidates";
import {
  COUNCILLOR_SEATS,
  ADVISOR_SEATS,
  COUNCILLOR_ROLES,
  TOTAL_SNAPSHOT_NFTS,
} from "@/lib/constants";
import { VoteTally } from "@/types";

// Demo tallies for preview when DB is empty
const DEMO_TALLIES: VoteTally[] = [
  { candidate_id: "chocoopanda", vote_count: 712 },
  { candidate_id: "erismaerd", vote_count: 845 },
  { candidate_id: "defijonas", vote_count: 634 },
  { candidate_id: "degenzard", vote_count: 789 },
  { candidate_id: "metafi_", vote_count: 523 },
  { candidate_id: "lmao", vote_count: 401 },
  { candidate_id: "seububu", vote_count: 678 },
  { candidate_id: "deadlypixel_sot", vote_count: 556 },
  { candidate_id: "mvb_gg", vote_count: 234 },
  { candidate_id: "kandaroshi", vote_count: 721 },
  { candidate_id: "bardygg", vote_count: 489 },
  { candidate_id: "aasupermani", vote_count: 412 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="bg-daory-card border border-daory-border p-3 sm:p-5">
      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-1 sm:mb-2">{label}</div>
      <div className={`text-xl sm:text-3xl font-extrabold tracking-tight leading-none ${accent ? "text-daory-cyan" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[10px] sm:text-xs text-daory-muted mt-1">{sub}</div>}
    </div>
  );
}

const ROLE_STYLE: Record<string, { dot: string; bar: string; chart: string }> = {
  "Community & Outreach": { dot: "bg-daory-cyan", bar: "bg-daory-cyan", chart: CHART_COLORS.cyan },
  "Finance & Investment": { dot: "bg-emerald-500", bar: "bg-emerald-500", chart: CHART_COLORS.emerald },
  "Infrastructure & Development": { dot: "bg-sky-500", bar: "bg-sky-500", chart: CHART_COLORS.sky },
  Advisor: { dot: "bg-amber-500", bar: "bg-amber-500", chart: CHART_COLORS.amber },
  Unspecified: { dot: "bg-gray-500", bar: "bg-gray-500", chart: CHART_COLORS.muted },
};

function isCouncillorRole(role: string) {
  return (COUNCILLOR_ROLES as readonly string[]).includes(role) || role === "Unspecified";
}

function shortRole(role: string) {
  if (role === "Community & Outreach") return "Community";
  if (role === "Finance & Investment") return "Finance";
  if (role === "Infrastructure & Development") return "Infra";
  return role;
}

export default function ResultsPage() {
  const [tallies, setTallies] = useState<VoteTally[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [uniqueVoters, setUniqueVoters] = useState(0);
  const [showResults, setShowResults] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data = await res.json();
          setShowResults(data.showResults);
          setTotalVotes(data.totalVotes);
          setUniqueVoters(data.uniqueVoters);
          if (data.tallies && data.tallies.length > 0) {
            setTallies(data.tallies);
            setIsDemo(false);
          } else if (data.showResults) {
            setTallies(DEMO_TALLIES);
            setTotalVotes(DEMO_TALLIES.reduce((s, t) => s + t.vote_count, 0));
            setUniqueVoters(1842);
            setIsDemo(true);
          }
        }
      } catch {
        setShowResults(true);
        setTallies(DEMO_TALLIES);
        setTotalVotes(DEMO_TALLIES.reduce((s, t) => s + t.vote_count, 0));
        setUniqueVoters(1842);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
  }, []);

  const tallyMap = useMemo(() => new Map(tallies.map((t) => [t.candidate_id, t.vote_count])), [tallies]);

  const councillorRanked = useMemo(
    () => candidates.filter((c) => isCouncillorRole(c.role)).map((c) => ({ ...c, votes: tallyMap.get(c.id) ?? 0 })).sort((a, b) => b.votes - a.votes),
    [tallyMap]
  );
  const advisorRanked = useMemo(
    () => candidates.filter((c) => c.role === "Advisor").map((c) => ({ ...c, votes: tallyMap.get(c.id) ?? 0 })).sort((a, b) => b.votes - a.votes),
    [tallyMap]
  );
  const allRanked = useMemo(
    () => [...candidates].map((c) => ({ ...c, votes: tallyMap.get(c.id) ?? 0 })).sort((a, b) => b.votes - a.votes),
    [tallyMap]
  );
  const maxVotes = useMemo(() => Math.max(...allRanked.map((c) => c.votes), 1), [allRanked]);
  const participation = totalVotes > 0 ? ((totalVotes / TOTAL_SNAPSHOT_NFTS) * 100) : 0;

  // Role groups for charts
  const roleGroups = useMemo(() => {
    const roles = ["Community & Outreach", "Finance & Investment", "Infrastructure & Development", "Advisor", "Unspecified"] as const;
    return roles.map((role) => {
      const rc = allRanked.filter((c) => c.role === role);
      return { role, candidates: rc, totalVotes: rc.reduce((s, c) => s + c.votes, 0) };
    }).filter((r) => r.candidates.length > 0);
  }, [allRanked]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-daory-cyan border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-daory-muted">Loading...</p>
      </div>
    );
  }

  // ==========================================
  // RESULTS HIDDEN
  // ==========================================
  if (!showResults) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white uppercase mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            Results <span className="text-daory-cyan">Pending</span>
          </h1>
          <p className="text-sm sm:text-base text-daory-muted max-w-lg mx-auto">
            Voting is in progress. Results will be revealed once the election period ends.
          </p>
        </div>

        {/* Participation gauge */}
        <div className="bg-daory-card border border-daory-border p-5 sm:p-8 mb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-4">Participation</div>
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#00bdd7" strokeWidth="8"
                strokeDasharray={`${participation * 2.64} ${264 - participation * 2.64}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{participation.toFixed(1)}%</span>
              <span className="text-[10px] text-daory-muted">voted</span>
            </div>
          </div>
          <p className="text-sm text-daory-muted">{fmt(totalVotes)} of {fmt(TOTAL_SNAPSHOT_NFTS)} NFTs</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-daory-border mb-6">
          <StatCard label="Ballots Cast" value={fmt(totalVotes)} accent />
          <StatCard label="Unique Voters" value={fmt(uniqueVoters)} sub="distinct wallets" />
          <StatCard label="Seats" value={`${COUNCILLOR_SEATS} + ${ADVISOR_SEATS}`} sub={`${COUNCILLOR_SEATS} council, ${ADVISOR_SEATS} advisors`} />
        </div>

        <div className="bg-daory-card border border-daory-border p-6 sm:p-8 text-center">
          <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-daory-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-white font-bold mb-1">Results are locked</p>
          <p className="text-daory-muted text-sm">Rankings will be visible when results are published.</p>
        </div>

        <div className="text-center text-xs text-daory-muted py-6">
          <span className="inline-block w-2 h-2 rounded-full bg-daory-cyan animate-pulse mr-2" />
          Checking for updates every 10 seconds
        </div>
      </div>
    );
  }

  // ==========================================
  // RESULTS VISIBLE
  // ==========================================
  const electedCouncillors = councillorRanked.slice(0, COUNCILLOR_SEATS);
  const notElectedCouncillors = councillorRanked.slice(COUNCILLOR_SEATS);
  const electedAdvisors = advisorRanked.slice(0, ADVISOR_SEATS);
  const notElectedAdvisors = advisorRanked.slice(ADVISOR_SEATS);

  const barData = {
    labels: allRanked.map((c) => c.discordName),
    datasets: [{
      label: "Votes", data: allRanked.map((c) => c.votes),
      backgroundColor: allRanked.map((c) => ROLE_STYLE[c.role]?.chart ?? CHART_COLORS.muted),
      borderRadius: 2, barThickness: 18,
    }],
  };

  const doughnutData = {
    labels: ["Councillors", "Advisors"],
    datasets: [{
      data: [
        councillorRanked.reduce((s, c) => s + c.votes, 0),
        advisorRanked.reduce((s, c) => s + c.votes, 0),
      ],
      backgroundColor: [CHART_COLORS.cyan, CHART_COLORS.amber],
      borderColor: "#060606", borderWidth: 3,
    }],
  };

  function ElectedCard({ c, i, color }: { c: typeof allRanked[0]; i: number; color: "cyan" | "amber" }) {
    const borderCls = color === "cyan" ? "border-daory-cyan/30" : "border-amber-500/30";
    const borderImg = color === "cyan" ? "border-daory-cyan" : "border-amber-500";
    const bgBadge = color === "cyan" ? "bg-daory-cyan" : "bg-amber-500";
    const textColor = color === "cyan" ? "text-daory-cyan" : "text-amber-400";
    return (
      <div className={`bg-daory-card border ${borderCls} p-3 sm:p-4 text-center relative`}>
        <div className={`absolute top-2 left-2 w-5 h-5 sm:w-6 sm:h-6 ${bgBadge} flex items-center justify-center`}>
          <span className="text-[10px] sm:text-xs font-bold text-black">{i + 1}</span>
        </div>
        <div className={`relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 overflow-hidden border-2 ${borderImg}`}>
          <Image src={c.imageUrl} alt={c.discordName} fill className="object-cover" unoptimized />
        </div>
        <p className="text-xs sm:text-sm font-bold text-white truncate">{c.discordName}</p>
        <p className="text-[10px] sm:text-[11px] text-daory-muted mt-0.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-sm mr-1 ${ROLE_STYLE[c.role]?.dot}`} />
          {shortRole(c.role)}
        </p>
        <p className={`text-base sm:text-lg font-extrabold ${textColor} mt-1 sm:mt-2`}>{fmt(c.votes)}</p>
        <p className="text-[9px] sm:text-[10px] text-daory-muted">votes</p>
      </div>
    );
  }

  function CandidateRow({ c, i, maxV, elected }: { c: typeof allRanked[0]; i: number; maxV: number; elected: boolean }) {
    const pct = maxV > 0 ? (c.votes / maxV) * 100 : 0;
    const style = ROLE_STYLE[c.role];
    return (
      <div className={`flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-4 border-b border-daory-border last:border-b-0 ${elected ? "bg-white/[0.02]" : ""}`}>
        <span className={`w-5 sm:w-7 text-xs sm:text-sm font-bold ${elected ? "text-daory-cyan" : "text-daory-muted"}`}>{i + 1}</span>
        <div className="relative w-8 h-8 overflow-hidden border border-daory-border flex-shrink-0">
          <Image src={c.imageUrl} alt={c.discordName} fill className="object-cover" unoptimized />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold text-white truncate">{c.discordName}</span>
            {elected && (
              <span className="hidden sm:inline px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-daory-cyan/15 text-daory-cyan border border-daory-cyan/30">
                Elected
              </span>
            )}
          </div>
          <span className="text-[10px] text-daory-muted">
            <span className={`inline-block w-1.5 h-1.5 rounded-sm mr-1 ${style?.dot}`} />
            {shortRole(c.role)}
          </span>
        </div>
        <div className="hidden sm:block w-24 lg:w-32">
          <div className="h-1.5 bg-white/[0.04] overflow-hidden">
            <div className={`h-full ${style?.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-xs sm:text-sm font-bold text-white tabular-nums w-12 sm:w-16 text-right">{fmt(c.votes)}</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white uppercase mb-2 sm:mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          Election <span className="text-daory-cyan">Results</span>
        </h1>
        <p className="text-sm text-daory-muted">
          {isDemo && <span className="mr-2 px-2 py-0.5 text-[10px] font-semibold bg-amber-600/20 text-amber-400 uppercase">Preview</span>}
          Live tallies for the DAOry Council Election.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-daory-border mb-4">
        <StatCard label="Total Votes" value={fmt(totalVotes)} sub={`of ${fmt(TOTAL_SNAPSHOT_NFTS)} NFTs`} accent />
        <StatCard label="Participation" value={`${participation.toFixed(1)}%`} sub="NFTs voted" />
        <StatCard label="Voters" value={fmt(uniqueVoters)} sub="distinct wallets" />
        <StatCard label="Avg NFTs/Voter" value={uniqueVoters > 0 ? (totalVotes / uniqueVoters).toFixed(1) : "0"} sub="voting power concentration" />
      </div>

      {/* Participation bar */}
      <div className="bg-daory-card border border-daory-border p-3 sm:p-4 mb-8 sm:mb-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted">Election Progress</span>
          <span className="text-xs sm:text-sm font-bold text-daory-cyan">{participation.toFixed(1)}% turnout</span>
        </div>
        <div className="h-3 sm:h-4 bg-white/[0.04] overflow-hidden">
          <div className="h-full bg-daory-cyan transition-all duration-1000" style={{ width: `${Math.min(participation, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] sm:text-[10px] text-daory-muted">
          <span>{fmt(totalVotes)} ballots cast</span>
          <span>{fmt(TOTAL_SNAPSHOT_NFTS - totalVotes)} remaining</span>
        </div>
      </div>

      {/* ============ ELECTED COUNCILLORS ============ */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-2xl font-bold text-white uppercase" style={{ fontFamily: "var(--font-heading)" }}>
            Elected <span className="text-daory-cyan">Councillors</span>
          </h2>
          <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold border border-daory-cyan text-daory-cyan uppercase">{COUNCILLOR_SEATS} seats</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4">
          {electedCouncillors.map((c, i) => <ElectedCard key={c.id} c={c} i={i} color="cyan" />)}
        </div>
        {notElectedCouncillors.length > 0 && (
          <div className="bg-daory-card border border-daory-border overflow-hidden">
            <div className="px-3 sm:px-4 py-2 border-b border-daory-border">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted">Not elected ({notElectedCouncillors.length})</span>
            </div>
            {notElectedCouncillors.map((c, i) => <CandidateRow key={c.id} c={c} i={COUNCILLOR_SEATS + i} maxV={councillorRanked[0]?.votes ?? 1} elected={false} />)}
          </div>
        )}
      </div>

      {/* ============ ELECTED ADVISORS ============ */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-2xl font-bold text-white uppercase" style={{ fontFamily: "var(--font-heading)" }}>
            Elected <span className="text-amber-400">Advisors</span>
          </h2>
          <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold border border-amber-500 text-amber-400 uppercase">{ADVISOR_SEATS} seats</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          {electedAdvisors.map((c, i) => <ElectedCard key={c.id} c={c} i={i} color="amber" />)}
        </div>
        {notElectedAdvisors.length > 0 && (
          <div className="bg-daory-card border border-daory-border overflow-hidden">
            <div className="px-3 sm:px-4 py-2 border-b border-daory-border">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted">Not elected ({notElectedAdvisors.length})</span>
            </div>
            {notElectedAdvisors.map((c, i) => <CandidateRow key={c.id} c={c} i={ADVISOR_SEATS + i} maxV={advisorRanked[0]?.votes ?? 1} elected={false} />)}
          </div>
        )}
      </div>

      {/* ============ CHARTS ROW 1: Bar + Doughnut ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
          <h3 className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-3 sm:mb-4">All Candidates</h3>
          <div className="h-[280px] sm:h-[400px]">
            <Bar data={barData} options={{
              indexAxis: "y", responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { backgroundColor: "#111", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, callbacks: { label: (ctx) => `${fmt(ctx.parsed.x ?? 0)} votes` } } },
              scales: { x: { ...SCALE_DEFAULTS, ticks: { ...SCALE_DEFAULTS.ticks, callback: (v) => fmt(v as number) } }, y: { ...SCALE_DEFAULTS, grid: { display: false }, ticks: { ...SCALE_DEFAULTS.ticks, color: "#ccc", font: { size: 11, family: "'Inter'" } } } },
            }} />
          </div>
        </div>
        <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
          <h3 className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-3 sm:mb-4">Council vs Advisors</h3>
          <div className="h-[180px] sm:h-[240px] mb-4">
            <Doughnut data={doughnutData} options={{
              responsive: true, maintainAspectRatio: false, cutout: "65%",
              plugins: { legend: { display: false }, tooltip: { backgroundColor: "#111", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)} votes` } } },
            }} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3" style={{ background: CHART_COLORS.cyan }} /><span className="text-daory-muted text-xs sm:text-sm">Councillors ({councillorRanked.length} candidates)</span></div>
              <span className="text-white font-bold tabular-nums text-sm">{fmt(councillorRanked.reduce((s, c) => s + c.votes, 0))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3" style={{ background: CHART_COLORS.amber }} /><span className="text-daory-muted text-xs sm:text-sm">Advisors ({advisorRanked.length} candidates)</span></div>
              <span className="text-white font-bold tabular-nums text-sm">{fmt(advisorRanked.reduce((s, c) => s + c.votes, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ PER-ROLE MINI RANKINGS ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 sm:mb-10">
        {roleGroups.map((r) => {
          const style = ROLE_STYLE[r.role];
          const isAdvisorRole = r.role === "Advisor";
          const seats = isAdvisorRole ? ADVISOR_SEATS : COUNCILLOR_SEATS;
          return (
            <div key={r.role} className="bg-daory-card border border-daory-border overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-daory-border">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${style?.dot}`} />
                  {shortRole(r.role)}
                </span>
                <span className="text-[10px] text-daory-muted">{fmt(r.totalVotes)} votes</span>
              </div>
              {r.candidates.map((c, i) => {
                const barPct = r.candidates[0].votes > 0 ? (c.votes / r.candidates[0].votes) * 100 : 0;
                const pct = r.totalVotes > 0 ? ((c.votes / r.totalVotes) * 100).toFixed(0) : "0";
                const isElected = isAdvisorRole ? i < ADVISOR_SEATS : i < COUNCILLOR_SEATS;
                return (
                  <div key={c.id} className={`px-3 sm:px-4 py-2 border-b border-daory-border last:border-b-0 ${isElected ? "bg-white/[0.02]" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="relative w-6 h-6 overflow-hidden border border-daory-border flex-shrink-0">
                        <Image src={c.imageUrl} alt={c.discordName} fill className="object-cover" unoptimized />
                      </div>
                      <span className="text-xs font-bold text-white flex-1 truncate">
                        {isElected && <span className={`${isAdvisorRole ? "text-amber-400" : "text-daory-cyan"} mr-1`}>#{i + 1}</span>}
                        {c.discordName}
                      </span>
                      <span className="text-xs text-daory-muted tabular-nums">{fmt(c.votes)} <span className="text-[10px]">({pct}%)</span></span>
                    </div>
                    <div className="h-1 bg-white/[0.04] overflow-hidden ml-8">
                      <div className={`h-full ${style?.bar} transition-all duration-700`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ============ FULL RANKING TABLE ============ */}
      <div className="mb-8 sm:mb-10">
        <h2 className="text-[11px] sm:text-[13px] font-bold uppercase tracking-widest text-daory-muted mb-4 sm:mb-5">Full Ranking</h2>
        <div className="bg-daory-card border border-daory-border overflow-hidden">
          {allRanked.map((c, i) => {
            const elected = electedCouncillors.some((e) => e.id === c.id) || electedAdvisors.some((e) => e.id === c.id);
            return <CandidateRow key={c.id} c={c} i={i} maxV={maxVotes} elected={elected} />;
          })}
        </div>
      </div>

      {/* ============ SUMMARY ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-daory-border mb-8">
        <div className="bg-daory-card p-4 sm:p-6">
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">Snapshot</div>
          <p className="text-base sm:text-lg font-bold text-white">{fmt(TOTAL_SNAPSHOT_NFTS)} NFTs</p>
          <p className="text-[10px] sm:text-xs text-daory-muted">March 24, 2025 &middot; Solana mainnet</p>
        </div>
        <div className="bg-daory-card p-4 sm:p-6">
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">Election</div>
          <p className="text-base sm:text-lg font-bold text-white">{COUNCILLOR_SEATS + ADVISOR_SEATS} seats filled</p>
          <p className="text-[10px] sm:text-xs text-daory-muted">{candidates.length} candidates &middot; {fmt(totalVotes)} votes cast</p>
        </div>
      </div>

      <div className="text-center text-[10px] sm:text-xs text-daory-muted py-4">
        <span className="inline-block w-2 h-2 rounded-full bg-daory-cyan animate-pulse mr-2" />
        Auto-refreshing every 10 seconds
      </div>
    </div>
  );
}
