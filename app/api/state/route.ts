import { NextResponse } from "next/server";
import { ensureDb, sql, KnKid, KnDeal } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const kids = (await sql`SELECT id, name, emoji, created_at FROM kn_kids ORDER BY created_at ASC`) as KnKid[];
    const deals = (await sql`
      SELECT id, kid_id, title, kid_promises, parent_promises,
             follow_up_date::text AS follow_up_date,
             status, notes, created_at, resolved_at
      FROM kn_deals
      ORDER BY
        CASE status WHEN 'open' THEN 0 ELSE 1 END,
        follow_up_date NULLS LAST,
        created_at DESC
    `) as KnDeal[];
    return NextResponse.json({ kids, deals });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
