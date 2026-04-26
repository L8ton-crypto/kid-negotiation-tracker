import { NextRequest, NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["open", "fulfilled", "broken"]);

function clean(v: unknown, max = 1000): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const kidId = Number(body?.kid_id);
    if (!Number.isInteger(kidId)) return NextResponse.json({ error: "kid_id required" }, { status: 400 });
    const title = clean(body?.title, 200);
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    const kidPromises = clean(body?.kid_promises, 2000);
    const parentPromises = clean(body?.parent_promises, 2000);
    const followUp = clean(body?.follow_up_date, 20);
    const notes = clean(body?.notes, 4000);
    const status = body?.status && VALID_STATUS.has(String(body.status)) ? String(body.status) : "open";

    // Validate kid exists
    const exists = await sql`SELECT id FROM kn_kids WHERE id=${kidId}`;
    if (exists.length === 0) return NextResponse.json({ error: "kid not found" }, { status: 404 });

    const rows = await sql`
      INSERT INTO kn_deals (kid_id, title, kid_promises, parent_promises, follow_up_date, status, notes)
      VALUES (${kidId}, ${title}, ${kidPromises}, ${parentPromises}, ${followUp}, ${status}, ${notes})
      RETURNING id, kid_id, title, kid_promises, parent_promises,
                follow_up_date::text AS follow_up_date,
                status, notes, created_at, resolved_at
    `;
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
