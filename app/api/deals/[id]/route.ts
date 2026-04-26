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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb();
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
    const body = await req.json();

    const title = body?.title !== undefined ? clean(body.title, 200) : undefined;
    const kidPromises = body?.kid_promises !== undefined ? clean(body.kid_promises, 2000) : undefined;
    const parentPromises = body?.parent_promises !== undefined ? clean(body.parent_promises, 2000) : undefined;
    const followUp = body?.follow_up_date !== undefined ? clean(body.follow_up_date, 20) : undefined;
    const notes = body?.notes !== undefined ? clean(body.notes, 4000) : undefined;
    let status: string | undefined;
    if (body?.status !== undefined) {
      const s = String(body.status);
      if (!VALID_STATUS.has(s)) return NextResponse.json({ error: "bad status" }, { status: 400 });
      status = s;
    }

    if (title !== undefined) await sql`UPDATE kn_deals SET title=${title} WHERE id=${id}`;
    if (kidPromises !== undefined) await sql`UPDATE kn_deals SET kid_promises=${kidPromises} WHERE id=${id}`;
    if (parentPromises !== undefined) await sql`UPDATE kn_deals SET parent_promises=${parentPromises} WHERE id=${id}`;
    if (followUp !== undefined) await sql`UPDATE kn_deals SET follow_up_date=${followUp} WHERE id=${id}`;
    if (notes !== undefined) await sql`UPDATE kn_deals SET notes=${notes} WHERE id=${id}`;
    if (status !== undefined) {
      if (status === "open") {
        await sql`UPDATE kn_deals SET status=${status}, resolved_at=NULL WHERE id=${id}`;
      } else {
        await sql`UPDATE kn_deals SET status=${status}, resolved_at=NOW() WHERE id=${id}`;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb();
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
    await sql`DELETE FROM kn_deals WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
