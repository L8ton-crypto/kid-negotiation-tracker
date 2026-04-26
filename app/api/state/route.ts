import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const kidsRaw = await sql`SELECT id, name, emoji, created_at FROM kn_kids ORDER BY created_at ASC`;
    const dealsRaw = await sql`
      SELECT id, kid_id, title, kid_promises, parent_promises,
             follow_up_date::text AS follow_up_date,
             status, notes, created_at, resolved_at
      FROM kn_deals
      ORDER BY
        CASE status WHEN 'open' THEN 0 ELSE 1 END,
        follow_up_date NULLS LAST,
        created_at DESC
    `;
    return NextResponse.json({
      kids: Array.isArray(kidsRaw) ? kidsRaw : (kidsRaw as { rows?: unknown[] })?.rows ?? [],
      deals: Array.isArray(dealsRaw) ? dealsRaw : (dealsRaw as { rows?: unknown[] })?.rows ?? [],
      _debug: {
        kidsType: typeof kidsRaw,
        kidsIsArray: Array.isArray(kidsRaw),
        kidsKeys: kidsRaw && typeof kidsRaw === "object" ? Object.keys(kidsRaw as object).slice(0, 10) : null,
        kidsLen: Array.isArray(kidsRaw) ? kidsRaw.length : ((kidsRaw as { rows?: unknown[] })?.rows?.length ?? null),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
