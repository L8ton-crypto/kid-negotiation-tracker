import { NextRequest, NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDb();
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
    const body = await req.json();
    const name = body?.name !== undefined ? String(body.name).trim() : undefined;
    const emoji = body?.emoji !== undefined ? (body.emoji ? String(body.emoji).slice(0, 8) : null) : undefined;
    if (name !== undefined && (!name || name.length > 60))
      return NextResponse.json({ error: "name invalid" }, { status: 400 });
    if (name !== undefined && emoji !== undefined) {
      await sql`UPDATE kn_kids SET name=${name}, emoji=${emoji} WHERE id=${id}`;
    } else if (name !== undefined) {
      await sql`UPDATE kn_kids SET name=${name} WHERE id=${id}`;
    } else if (emoji !== undefined) {
      await sql`UPDATE kn_kids SET emoji=${emoji} WHERE id=${id}`;
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
    await sql`DELETE FROM kn_kids WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
