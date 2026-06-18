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
import { validateOptionsForType } from "@/lib/proposals";
import { Proposal } from "@/types/proposal";

export const dynamic = "force-dynamic";

// id can be a UUID or a slug — we accept both
function buildLookup(supabase: ReturnType<typeof createReadClient>, id: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  return supabase!
    .from("proposals")
    .select("*")
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();
}

// ----------------- GET -----------------
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createReadClient();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { data, error } = await buildLookup(supabase, id);
  if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: data as Proposal });
}

// ----------------- PATCH (update draft / publish / cancel) -----------------
const patchSchema = z.object({
  action: z.enum(["update", "publish", "cancel"]),
  cancelled_reason: z.string().max(500).optional(),

  // Update payload (only honoured when action === 'update' on a draft)
  title: z.string().min(3).max(140).optional(),
  summary: z.string().max(200).nullable().optional(),
  description: z.string().max(50_000).optional(),
  category: z
    .enum(["Treasury", "Governance", "Community", "Marketing", "Partnership", "Other"])
    .optional(),
  discussion_url: z.string().url().nullable().optional().or(z.literal("")),
  type: z.enum(["single_choice", "multi_choice"]).optional(),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/i),
        label: z.string().min(1).max(120),
      })
    )
    .min(2)
    .max(20)
    .optional(),
  max_choices: z.number().int().min(1).max(20).nullable().optional(),
  allow_vote_change: z.boolean().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  discussion_period_hours: z.number().int().min(0).max(720).optional(),
  quorum_nfts: z.number().int().min(1).max(100_000).nullable().optional(),
  quorum_pct: z.number().min(0).max(100).nullable().optional(),
  approval_threshold_pct: z.number().min(0).max(100).optional(),
  binding: z.boolean().optional(),
  show_results_during: z.boolean().optional(),
  show_voter_list: z.boolean().optional(),

  wallet: z.string(),
  signature: z.string(),
  message: z.string(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid payload", details: String(err) },
      { status: 400 }
    );
  }

  if (!isAuthorizedCreator(body.wallet)) {
    return NextResponse.json({ error: "Wallet not authorized" }, { status: 403 });
  }

  // Fetch current proposal
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data: current } = await supabase
    .from("proposals")
    .select("*")
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();
  const proposal = current as Proposal | null;
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the creator (or any whitelisted wallet as admin) can modify.
  // For now: only the creator can modify their own proposal.
  if (proposal.creator_wallet !== body.wallet) {
    return NextResponse.json(
      { error: "Only the proposal creator can modify this proposal" },
      { status: 403 }
    );
  }

  // Verify signature against expected message
  const expectedHash = hashPayload({ id: proposal.id, action: body.action });
  const ts = body.message
    .split("\n")
    .find((l) => l.startsWith("Timestamp:"))
    ?.replace("Timestamp: ", "");
  if (!ts) return NextResponse.json({ error: "Bad message format" }, { status: 400 });
  const expected = createProposalAuthorMessage(body.action, expectedHash, ts);
  if (body.message !== expected) {
    return NextResponse.json({ error: "Message mismatch" }, { status: 400 });
  }
  if (Math.abs(Date.now() - new Date(ts).getTime()) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Message expired" }, { status: 400 });
  }
  if (!verifySignature(body.message, body.signature, body.wallet)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ---- Branch on action ----
  if (body.action === "cancel") {
    if (proposal.status === "cancelled" || proposal.status === "ended") {
      return NextResponse.json(
        { error: `Cannot cancel a ${proposal.status} proposal` },
        { status: 400 }
      );
    }
    const { data: updated, error } = await supabase
      .from("proposals")
      .update({
        status: "cancelled",
        cancelled_reason: body.cancelled_reason || null,
      })
      .eq("id", proposal.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
    return NextResponse.json({ proposal: updated as Proposal });
  }

  if (body.action === "publish") {
    if (proposal.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot publish from status: ${proposal.status}` },
        { status: 400 }
      );
    }
    const newStatus =
      new Date(proposal.starts_at).getTime() > Date.now() ? "scheduled" : "active";
    const { data: updated, error } = await supabase
      .from("proposals")
      .update({ status: newStatus })
      .eq("id", proposal.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Publish failed" }, { status: 500 });
    return NextResponse.json({ proposal: updated as Proposal });
  }

  // action === 'update' — only valid for drafts
  if (proposal.status !== "draft") {
    return NextResponse.json(
      { error: "Only drafts can be edited" },
      { status: 400 }
    );
  }

  const options = body.options;
  const type = body.type ?? proposal.type;
  if (options) {
    const err = validateOptionsForType(
      type,
      options,
      body.max_choices ?? proposal.max_choices
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const description =
    body.description !== undefined
      ? sanitizeProposalHtml(body.description)
      : undefined;

  const patch: Partial<Proposal> = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.summary !== undefined) patch.summary = body.summary?.trim() || null;
  if (description !== undefined) patch.description = description;
  if (body.category) patch.category = body.category;
  if (body.discussion_url !== undefined)
    patch.discussion_url = body.discussion_url || null;
  if (body.type) patch.type = body.type;
  if (options) patch.options = options;
  if (body.max_choices !== undefined) patch.max_choices = body.max_choices;
  if (body.allow_vote_change !== undefined)
    patch.allow_vote_change = body.allow_vote_change;
  if (body.starts_at) patch.starts_at = body.starts_at;
  if (body.ends_at) patch.ends_at = body.ends_at;
  if (body.discussion_period_hours !== undefined)
    patch.discussion_period_hours = body.discussion_period_hours;
  if (body.quorum_nfts !== undefined) patch.quorum_nfts = body.quorum_nfts;
  if (body.quorum_pct !== undefined) patch.quorum_pct = body.quorum_pct;
  if (body.approval_threshold_pct !== undefined)
    patch.approval_threshold_pct = body.approval_threshold_pct;
  if (body.binding !== undefined) patch.binding = body.binding;
  if (body.show_results_during !== undefined)
    patch.show_results_during = body.show_results_during;
  if (body.show_voter_list !== undefined)
    patch.show_voter_list = body.show_voter_list;

  if (patch.starts_at && patch.ends_at) {
    if (new Date(patch.ends_at).getTime() <= new Date(patch.starts_at).getTime()) {
      return NextResponse.json(
        { error: "ends_at must be after starts_at" },
        { status: 400 }
      );
    }
  }

  const { data: updated, error } = await supabase
    .from("proposals")
    .update(patch)
    .eq("id", proposal.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ proposal: updated as Proposal });
}
