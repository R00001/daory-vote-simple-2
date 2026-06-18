import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createReadClient } from "@/lib/supabase";
import { verifySignature } from "@/lib/verify-signature";
import { isAuthorizedCreator } from "@/lib/creators";
import { sanitizeProposalHtml } from "@/lib/sanitize";
import {
  createProposalAuthorMessage,
  hashPayload,
} from "@/lib/proposal-message";
import { slugify, validateOptionsForType } from "@/lib/proposals";
import {
  Proposal,
  PROPOSAL_CATEGORIES,
} from "@/types/proposal";

export const dynamic = "force-dynamic";

// ----------------- GET /api/proposals -----------------
export async function GET(request: NextRequest) {
  const supabase = createReadClient();
  if (!supabase) {
    return NextResponse.json({ proposals: [] satisfies Proposal[] });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const category = sp.get("category");
  const limit = Math.min(Number(sp.get("limit") || 50), 200);

  let q = supabase
    .from("proposals")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && ["scheduled", "active", "ended", "cancelled"].includes(status)) {
    q = q.eq("status", status);
  }
  if (category && (PROPOSAL_CATEGORIES as readonly string[]).includes(category)) {
    q = q.eq("category", category);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Failed to load proposals" }, { status: 500 });
  }
  return NextResponse.json({ proposals: (data ?? []) as Proposal[] });
}

// ----------------- POST /api/proposals -----------------
const optionSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/i),
  label: z.string().min(1).max(120),
});

const createSchema = z.object({
  title: z.string().min(3).max(140),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional(),
  summary: z.string().max(200).optional(),
  description: z.string().max(50_000),
  category: z.enum([
    "Treasury",
    "Governance",
    "Community",
    "Marketing",
    "Partnership",
    "Other",
  ]),
  discussion_url: z.string().url().optional().or(z.literal("")),

  type: z.enum(["single_choice", "multi_choice"]),
  options: z.array(optionSchema).min(2).max(20),
  max_choices: z.number().int().min(1).max(20).optional(),
  allow_vote_change: z.boolean(),

  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  discussion_period_hours: z.number().int().min(0).max(720),

  quorum_nfts: z.number().int().min(1).max(100_000).optional(),
  quorum_pct: z.number().min(0).max(100).optional(),
  approval_threshold_pct: z.number().min(0).max(100),
  binding: z.boolean(),

  show_results_during: z.boolean(),
  show_voter_list: z.boolean(),

  publish: z.boolean(),

  wallet: z.string().min(32).max(64),
  signature: z.string().min(32),
  message: z.string(),
});

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid payload", details: String(err) },
      { status: 400 }
    );
  }

  // Whitelist check
  if (!isAuthorizedCreator(body.wallet)) {
    return NextResponse.json(
      { error: "Wallet not authorized to create proposals" },
      { status: 403 }
    );
  }

  const options = body.options;
  const optionErr = validateOptionsForType(body.type, options, body.max_choices);
  if (optionErr) {
    return NextResponse.json({ error: optionErr }, { status: 400 });
  }

  if (new Date(body.ends_at).getTime() <= new Date(body.starts_at).getTime()) {
    return NextResponse.json(
      { error: "ends_at must be after starts_at" },
      { status: 400 }
    );
  }

  // Sanitize description
  const description = sanitizeProposalHtml(body.description);

  // Verify signed message
  const payloadForSig = {
    title: body.title.trim(),
    slug: body.slug,
    type: body.type,
    options,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    publish: body.publish,
  };
  const expectedHash = hashPayload(payloadForSig);

  const timestamp = body.message
    .split("\n")
    .find((l) => l.startsWith("Timestamp:"))
    ?.replace("Timestamp: ", "");
  const action = body.publish ? "create" : "create";
  const expectedMessage = createProposalAuthorMessage(
    action,
    expectedHash,
    timestamp || ""
  );
  if (!timestamp || body.message !== expectedMessage) {
    return NextResponse.json(
      { error: "Message content mismatch" },
      { status: 400 }
    );
  }
  if (Math.abs(Date.now() - new Date(timestamp).getTime()) > 5 * 60 * 1000) {
    return NextResponse.json(
      { error: "Message expired, please re-sign" },
      { status: 400 }
    );
  }
  if (!verifySignature(body.message, body.signature, body.wallet)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Resolve slug (ensure uniqueness with -2, -3 suffixes)
  const base = body.slug || slugify(body.title);
  if (!base) {
    return NextResponse.json({ error: "Title is too short for slug" }, { status: 400 });
  }
  const slug = await resolveSlug(supabase, base);

  const initialStatus = body.publish
    ? new Date(body.starts_at).getTime() > Date.now()
      ? "scheduled"
      : "active"
    : "draft";

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      slug,
      title: body.title.trim(),
      summary: body.summary?.trim() || null,
      description,
      category: body.category,
      discussion_url: body.discussion_url || null,

      type: body.type,
      options,
      max_choices: body.type === "multi_choice" ? body.max_choices : null,
      allow_vote_change: body.allow_vote_change,

      starts_at: body.starts_at,
      ends_at: body.ends_at,
      discussion_period_hours: body.discussion_period_hours,

      quorum_nfts: body.quorum_nfts ?? null,
      quorum_pct: body.quorum_pct ?? null,
      approval_threshold_pct: body.approval_threshold_pct,
      binding: body.binding,

      show_results_during: body.show_results_during,
      show_voter_list: body.show_voter_list,

      status: initialStatus,
      creator_wallet: body.wallet,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create proposal", details: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ proposal: data as Proposal });
}

async function resolveSlug(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  base: string
): Promise<string> {
  let candidate = base;
  let i = 2;
  while (true) {
    const { data } = await supabase
      .from("proposals")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i}`;
    i++;
    if (i > 100) return `${base}-${Date.now()}`;
  }
}
