"use client";

import { useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import {
  PROPOSAL_CATEGORIES,
  Proposal,
  ProposalCategory,
  ProposalOption,
  ProposalType,
  DEFAULT_OPTIONS,
} from "@/types/proposal";
import {
  createProposalAuthorMessage,
  hashPayload,
} from "@/lib/proposal-message";
import { getDefaultOptions, slugify } from "@/lib/proposals";
import RichTextEditor from "./RichTextEditor";
import RichTextView from "./RichTextView";

interface ProposalFormProps {
  /** When provided, the form is in edit mode for a draft. */
  initial?: Proposal;
}

interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  summary: string;
  description: string;
  category: ProposalCategory;
  discussion_url: string;

  type: ProposalType;
  options: ProposalOption[];
  max_choices: number;
  allow_vote_change: boolean;

  starts_at: string;
  ends_at: string;
  discussion_period_hours: number;

  quorumMode: "none" | "nfts" | "pct";
  quorum_nfts: number;
  quorum_pct: number;
  approval_threshold_pct: number;
  binding: boolean;

  show_results_during: boolean;
  show_voter_list: boolean;
}

const DEFAULT_DURATION_HOURS = 7 * 24;

function toLocalDt(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalDt(local: string): Date {
  return new Date(local);
}

function defaultState(initial?: Proposal): FormState {
  const now = new Date();
  const end = new Date(now.getTime() + DEFAULT_DURATION_HOURS * 3600_000);
  if (initial) {
    const quorumMode: FormState["quorumMode"] = initial.quorum_nfts != null
      ? "nfts"
      : initial.quorum_pct != null
      ? "pct"
      : "none";
    return {
      title: initial.title,
      slug: initial.slug,
      slugTouched: true,
      summary: initial.summary || "",
      description: initial.description,
      category: initial.category,
      discussion_url: initial.discussion_url || "",
      type: initial.type,
      options: initial.options.length ? initial.options : getDefaultOptions(),
      max_choices: initial.max_choices ?? 1,
      allow_vote_change: initial.allow_vote_change,
      starts_at: toLocalDt(new Date(initial.starts_at)),
      ends_at: toLocalDt(new Date(initial.ends_at)),
      discussion_period_hours: initial.discussion_period_hours,
      quorumMode,
      quorum_nfts: initial.quorum_nfts ?? 0,
      quorum_pct: initial.quorum_pct ?? 0,
      approval_threshold_pct: initial.approval_threshold_pct,
      binding: initial.binding,
      show_results_during: initial.show_results_during,
      show_voter_list: initial.show_voter_list,
    };
  }
  return {
    title: "",
    slug: "",
    slugTouched: false,
    summary: "",
    description: "",
    category: "Governance",
    discussion_url: "",
    type: "single_choice",
    options: getDefaultOptions(),
    max_choices: 1,
    allow_vote_change: true,
    starts_at: toLocalDt(now),
    ends_at: toLocalDt(end),
    discussion_period_hours: 0,
    quorumMode: "none",
    quorum_nfts: 0,
    quorum_pct: 10,
    approval_threshold_pct: 10,
    binding: false,
    show_results_during: true,
    show_voter_list: true,
  };
}

export default function ProposalForm({ initial }: ProposalFormProps) {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const [f, setF] = useState<FormState>(() => defaultState(initial));
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  // Keep slug in sync with title until user manually edits slug
  useEffect(() => {
    if (!f.slugTouched && !isEdit) {
      setF((s) => ({ ...s, slug: slugify(s.title) }));
    }
  }, [f.title, f.slugTouched, isEdit]);

  // Keep max_choices valid when options change
  useEffect(() => {
    if (f.type === "multi_choice" && f.max_choices > f.options.length) {
      setF((s) => ({ ...s, max_choices: Math.max(1, s.options.length) }));
    }
  }, [f.type, f.max_choices, f.options.length]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const addOption = () => {
    setF((s) => {
      const used = new Set(s.options.map((o) => o.id));
      let n = s.options.length + 1;
      let candidate = `opt-${n}`;
      while (used.has(candidate)) {
        n++;
        candidate = `opt-${n}`;
      }
      return {
        ...s,
        options: [
          ...s.options,
          {
            id: candidate,
            label: `Option ${String.fromCharCode(65 + Math.min(s.options.length, 25))}`,
          },
        ],
      };
    });
  };
  const resetToDefaults = () => {
    setF((s) => ({ ...s, options: getDefaultOptions() }));
  };
  const removeOption = (idx: number) =>
    setF((s) => ({ ...s, options: s.options.filter((_, i) => i !== idx) }));
  const updateOption = (idx: number, patch: Partial<ProposalOption>) =>
    setF((s) => ({
      ...s,
      options: s.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));

  const isDefaultOptionSet = useMemo(
    () =>
      f.options.length === DEFAULT_OPTIONS.length &&
      f.options.every((o, i) => o.id === DEFAULT_OPTIONS[i].id && o.label === DEFAULT_OPTIONS[i].label),
    [f.options]
  );

  const validation = useMemo<string | null>(() => {
    if (f.title.trim().length < 3) return "Title must be at least 3 characters";
    if (f.title.length > 140) return "Title too long (max 140)";
    if (!f.slug || !/^[a-z0-9-]+$/.test(f.slug)) return "Slug must be lowercase letters/numbers/hyphens";
    if (f.slug.length < 3 || f.slug.length > 80) return "Slug length must be 3–80 chars";
    if (f.summary.length > 200) return "Summary too long (max 200)";
    if (f.description.replace(/<[^>]*>/g, "").trim().length < 10)
      return "Description is too short";
    if (f.options.length < 2) return "Add at least 2 options";
    if (f.options.length > 20) return "Too many options (max 20)";
    const ids = new Set<string>();
    for (const o of f.options) {
      if (!o.id || !/^[a-z0-9_-]+$/i.test(o.id)) return "Option ids must be alphanumeric";
      if (!o.label || o.label.trim().length === 0) return "Option labels cannot be empty";
      if (o.label.length > 120) return "Option labels must be 1–120 chars";
      if (ids.has(o.id)) return `Duplicate option id: ${o.id}`;
      ids.add(o.id);
    }
    if (f.type === "multi_choice") {
      if (f.max_choices < 1 || f.max_choices > f.options.length)
        return "Max choices must be between 1 and total options";
    }
    if (!f.starts_at || !f.ends_at) return "Dates required";
    if (fromLocalDt(f.ends_at).getTime() <= fromLocalDt(f.starts_at).getTime())
      return "End must be after start";
    if (f.approval_threshold_pct < 0 || f.approval_threshold_pct > 100)
      return "Approval threshold must be 0–100";
    if (f.quorumMode === "nfts" && (f.quorum_nfts < 1 || f.quorum_nfts > 100_000))
      return "Quorum NFTs must be 1–100000";
    if (f.quorumMode === "pct" && (f.quorum_pct < 0 || f.quorum_pct > 100))
      return "Quorum pct must be 0–100";
    return null;
  }, [f]);

  const buildBody = (publish: boolean) => ({
    title: f.title.trim(),
    slug: f.slug || undefined,
    summary: f.summary.trim() || undefined,
    description: f.description,
    category: f.category,
    discussion_url: f.discussion_url || undefined,
    type: f.type,
    options: f.options,
    max_choices: f.type === "multi_choice" ? f.max_choices : undefined,
    allow_vote_change: f.allow_vote_change,
    starts_at: fromLocalDt(f.starts_at).toISOString(),
    ends_at: fromLocalDt(f.ends_at).toISOString(),
    discussion_period_hours: f.discussion_period_hours,
    quorum_nfts: f.quorumMode === "nfts" ? f.quorum_nfts : undefined,
    quorum_pct: f.quorumMode === "pct" ? f.quorum_pct : undefined,
    approval_threshold_pct: f.approval_threshold_pct,
    binding: f.binding,
    show_results_during: f.show_results_during,
    show_voter_list: f.show_voter_list,
    publish,
  });

  const submit = async (publish: boolean) => {
    if (!publicKey || !signMessage) {
      setError("Connect a wallet first");
      return;
    }
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const wallet = publicKey.toBase58();
      const ts = new Date().toISOString();

      if (isEdit && initial) {
        const action: "update" | "publish" = publish ? "publish" : "update";
        const hash = hashPayload({ id: initial.id, action });
        const message = createProposalAuthorMessage(action, hash, ts);
        const sigBytes = await signMessage(new TextEncoder().encode(message));
        const signature = bs58.encode(sigBytes);

        const body = buildBody(false);
        const res = await fetch(`/api/proposals/${initial.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            wallet,
            signature,
            message,
            ...(action === "update" ? body : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        const updated = json.proposal as Proposal;
        if (action === "publish") {
          router.push(`/proposals/${updated.slug}`);
        } else {
          router.push(`/proposals/${updated.slug}/edit`);
        }
      } else {
        const body = buildBody(publish);
        const payloadForSig = {
          title: body.title,
          slug: body.slug,
          type: body.type,
          options: body.options,
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          publish,
        };
        const hash = hashPayload(payloadForSig);
        const message = createProposalAuthorMessage("create", hash, ts);
        const sigBytes = await signMessage(new TextEncoder().encode(message));
        const signature = bs58.encode(sigBytes);

        const res = await fetch(`/api/proposals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            wallet,
            signature,
            message,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Create failed");
        const created = json.proposal as Proposal;
        router.push(
          publish ? `/proposals/${created.slug}` : `/proposals/${created.slug}/edit`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-px bg-daory-border">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
              !showPreview
                ? "bg-daory-card text-daory-cyan border-b-2 border-daory-cyan"
                : "bg-daory-card text-daory-muted hover:text-white"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
              showPreview
                ? "bg-daory-card text-daory-cyan border-b-2 border-daory-cyan"
                : "bg-daory-card text-daory-muted hover:text-white"
            }`}
          >
            Preview
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={submitting || !!validation}
            onClick={() => submit(false)}
            className="px-4 py-2.5 border border-daory-border text-daory-muted hover:text-white hover:border-daory-cyan font-bold uppercase tracking-wider text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "…" : isEdit ? "Save Draft" : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={submitting || !!validation}
            onClick={() => submit(true)}
            className="px-4 py-2.5 bg-daory-cyan text-black font-bold uppercase tracking-wider text-xs hover:bg-daory-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "…" : isEdit ? "Publish" : "Publish Now"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-800/50 bg-red-900/10 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {validation && (
        <div className="border border-amber-700/30 bg-amber-900/10 p-3">
          <p className="text-amber-300 text-sm">{validation}</p>
        </div>
      )}

      {showPreview ? (
        <PreviewPanel f={f} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* LEFT — content */}
          <div className="space-y-6">
            <Section title="Identity">
              <Field label="Title">
                <input
                  value={f.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={140}
                  placeholder="A short, descriptive title"
                  className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/40 focus:border-daory-cyan focus:outline-none transition-colors"
                />
              </Field>
              <Field label="Slug">
                <input
                  value={f.slug}
                  onChange={(e) => setF((s) => ({ ...s, slug: e.target.value.toLowerCase(), slugTouched: true }))}
                  disabled={isEdit}
                  maxLength={80}
                  placeholder="auto-generated-from-title"
                  className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/40 focus:border-daory-cyan focus:outline-none transition-colors font-mono disabled:opacity-50"
                />
              </Field>
              <Field label="Summary" hint="Short tagline shown in the proposals list">
                <input
                  value={f.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  maxLength={200}
                  placeholder="One-line summary…"
                  className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/40 focus:border-daory-cyan focus:outline-none transition-colors"
                />
              </Field>
              <Field label="Description" hint="Rich text — supports headings, lists, links, images">
                <RichTextEditor value={f.description} onChange={(html) => set("description", html)} />
              </Field>
              <Field label="Discussion URL" hint="Link to a Discord thread or forum post (optional)">
                <input
                  value={f.discussion_url}
                  onChange={(e) => set("discussion_url", e.target.value)}
                  placeholder="https://discord.com/channels/…"
                  className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white placeholder-daory-muted/40 focus:border-daory-cyan focus:outline-none transition-colors font-mono"
                />
              </Field>
            </Section>

            <Section title="Voting Options">
              <Field
                label="Options"
                hint="Default is Yes / No / Abstain. Edit labels, add new ones (e.g. candidate names for an emergency election), or remove any."
              >
                <div className="space-y-2">
                  {f.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-daory-muted w-6 text-center">
                        {i + 1}
                      </span>
                      <input
                        value={o.label}
                        onChange={(e) => updateOption(i, { label: e.target.value })}
                        placeholder="Option label"
                        maxLength={120}
                        className="flex-1 bg-black border border-daory-border px-3 py-2 text-sm text-white focus:border-daory-cyan focus:outline-none"
                      />
                      <input
                        value={o.id}
                        onChange={(e) =>
                          updateOption(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })
                        }
                        placeholder="id"
                        title="Stable option id (used in URLs and on-chain)"
                        className="w-28 bg-black border border-daory-border px-3 py-2 text-xs text-daory-muted font-mono focus:border-daory-cyan focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        disabled={f.options.length <= 2}
                        className="px-3 py-2 border border-daory-border text-daory-muted hover:text-red-400 hover:border-red-800/50 text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addOption}
                      disabled={f.options.length >= 20}
                      className="flex-1 px-3 py-2 border border-dashed border-daory-border text-daory-muted hover:text-daory-cyan hover:border-daory-cyan text-xs uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      + Add Option
                    </button>
                    {!isDefaultOptionSet && (
                      <button
                        type="button"
                        onClick={resetToDefaults}
                        className="px-3 py-2 border border-daory-border text-daory-muted hover:text-white hover:border-daory-cyan text-xs uppercase tracking-wider transition-colors"
                      >
                        Reset to Yes / No / Abstain
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              <Field label="Voting Mode">
                <div className="grid grid-cols-2 gap-px bg-daory-border">
                  {(["single_choice", "multi_choice"] as ProposalType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("type", t)}
                      className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                        f.type === t
                          ? "bg-daory-cyan/10 text-daory-cyan"
                          : "bg-daory-card text-daory-muted hover:text-white"
                      }`}
                    >
                      {t === "single_choice" ? "Pick One" : "Pick Multiple"}
                    </button>
                  ))}
                </div>
              </Field>

              {f.type === "multi_choice" && (
                <Field label="Max Choices" hint="Maximum number of options a voter can pick">
                  <input
                    type="number"
                    min={1}
                    max={f.options.length}
                    value={f.max_choices}
                    onChange={(e) => set("max_choices", Math.max(1, Number(e.target.value) || 1))}
                    className="w-32 bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                  />
                </Field>
              )}

              <Toggle
                label="Allow Vote Changes"
                hint="Voters can re-sign to change their vote until the proposal ends."
                value={f.allow_vote_change}
                onChange={(v) => set("allow_vote_change", v)}
              />
            </Section>

            <Section title="Schedule">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Starts At">
                  <input
                    type="datetime-local"
                    value={f.starts_at}
                    onChange={(e) => set("starts_at", e.target.value)}
                    className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                  />
                </Field>
                <Field label="Ends At">
                  <input
                    type="datetime-local"
                    value={f.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                    className="w-full bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                  />
                </Field>
              </div>
            </Section>

            {/* Advanced (collapsed by default — most votes won't need this) */}
            <div className="bg-daory-card border border-daory-border">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 text-left"
              >
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-daory-muted">
                  Advanced
                </span>
                <span className="text-daory-cyan text-xs font-bold uppercase tracking-wider">
                  {showAdvanced ? "Hide −" : "Show +"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 sm:px-5 pb-5 space-y-5 border-t border-daory-border pt-5">
                  <Field label="Discussion Period (hours)" hint="Optional delay before voting opens — gives the community time to read and discuss.">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={f.discussion_period_hours}
                      onChange={(e) => set("discussion_period_hours", Math.max(0, Number(e.target.value) || 0))}
                      className="w-32 bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                    />
                  </Field>

                  <Field label="Quorum" hint="Minimum participation required for the proposal to be valid. Leave on 'None' for simple majority votes.">
                    <div className="grid grid-cols-3 gap-px bg-daory-border mb-3">
                      {(["none", "nfts", "pct"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("quorumMode", m)}
                          className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                            f.quorumMode === m
                              ? "bg-daory-cyan/10 text-daory-cyan"
                              : "bg-daory-card text-daory-muted hover:text-white"
                          }`}
                        >
                          {m === "none" ? "None" : m === "nfts" ? "Min NFTs" : "% of Snapshot"}
                        </button>
                      ))}
                    </div>
                    {f.quorumMode === "nfts" && (
                      <input
                        type="number"
                        min={1}
                        max={100_000}
                        value={f.quorum_nfts}
                        onChange={(e) => set("quorum_nfts", Math.max(1, Number(e.target.value) || 1))}
                        className="w-40 bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                      />
                    )}
                    {f.quorumMode === "pct" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={f.quorum_pct}
                          onChange={(e) => set("quorum_pct", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="w-32 bg-black border border-daory-border px-4 py-2.5 text-sm text-white focus:border-daory-cyan focus:outline-none"
                        />
                        <span className="text-sm text-daory-muted">% of snapshot</span>
                      </div>
                    )}
                  </Field>

                  <Field
                    label={`Approval Threshold (${f.approval_threshold_pct}%)`}
                    hint="Minimum share of total votes the winning option must reach for the proposal to pass."
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={f.approval_threshold_pct}
                      onChange={(e) => set("approval_threshold_pct", Number(e.target.value))}
                      className="w-full"
                    />
                  </Field>

                  <Toggle
                    label="Binding"
                    hint="Flag as binding — passed proposals must be executed by the council."
                    value={f.binding}
                    onChange={(v) => set("binding", v)}
                  />
                  <Toggle
                    label="Show Results During Voting"
                    hint="Off = tallies hidden until voting ends."
                    value={f.show_results_during}
                    onChange={(v) => set("show_results_during", v)}
                  />
                  <Toggle
                    label="Show Voter List"
                    hint="Off = aggregate-only (no who-voted-what disclosed)."
                    value={f.show_voter_list}
                    onChange={(v) => set("show_voter_list", v)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — sidebar */}
          <div className="space-y-5">
            <Section title="Category">
              <div className="grid grid-cols-2 gap-2">
                {PROPOSAL_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", c)}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                      f.category === c
                        ? "border-daory-cyan text-daory-cyan bg-daory-cyan/5"
                        : "border-daory-border text-daory-muted hover:text-white hover:border-daory-border-hover"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-daory-card border border-daory-border p-4 sm:p-5">
      <h2 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-daory-muted mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-daory-muted mb-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-daory-muted/80 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full text-left flex items-start gap-3"
    >
      <span
        className={`mt-0.5 w-9 h-5 flex-shrink-0 border transition-colors relative ${
          value ? "bg-daory-cyan border-daory-cyan" : "bg-black border-daory-border"
        }`}
      >
        <span
          className={`absolute top-0.5 ${value ? "right-0.5" : "left-0.5"} w-3.5 h-3.5 transition-all ${
            value ? "bg-black" : "bg-daory-muted"
          }`}
        />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint && <span className="block text-[10px] text-daory-muted mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </button>
  );
}

function PreviewPanel({ f }: { f: FormState }) {
  return (
    <div className="bg-daory-card border border-daory-border p-5 sm:p-7">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-white/[0.05] text-daory-muted border border-daory-border">
          {f.category}
        </span>
        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-white/[0.05] text-daory-muted border border-daory-border">
          Preview
        </span>
        {f.binding && (
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-daory-cyan/10 text-daory-cyan border border-daory-cyan/30">
            Binding
          </span>
        )}
      </div>
      <h1
        className="text-2xl sm:text-4xl font-bold text-white uppercase tracking-tight mb-3"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {f.title || "Untitled proposal"}
      </h1>
      {f.summary && <p className="text-base text-daory-muted mb-4">{f.summary}</p>}
      <RichTextView html={f.description || "<p><em>No description yet.</em></p>"} />

      <div className="mt-6 border-t border-daory-border pt-5">
        <p className="text-[10px] uppercase tracking-wider text-daory-muted mb-3">Options</p>
        <ul className="space-y-1.5">
          {f.options.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-sm text-white">
              <span className="w-1.5 h-1.5 bg-daory-cyan" />
              {o.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
