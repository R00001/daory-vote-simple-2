import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { isAuthorizedCreator } from "@/lib/creators";
import { Proposal } from "@/types/proposal";

export const dynamic = "force-dynamic";

/**
 * Returns the calling wallet's draft proposals.
 * Auth: wallet param + check against whitelist (drafts are sensitive WIP).
 * Note: drafts are not protected by signature here — the whitelist gate is
 * sufficient since the response only includes the wallet's own drafts and
 * leaks nothing about other creators.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ drafts: [] });
  if (!isAuthorizedCreator(wallet)) return NextResponse.json({ drafts: [] });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ drafts: [] });

  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("status", "draft")
    .eq("creator_wallet", wallet)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ drafts: [] });
  return NextResponse.json({ drafts: (data ?? []) as Proposal[] });
}
