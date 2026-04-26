import { NextRequest, NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const emoji = body?.emoji ? String(body.emoji).slice(0, 8) : null;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: "name too long" }, { status: 400 });
    const rows = await sql`
      INSERT INTO kn_kids (name, emoji) VALUES (${name}, ${emoji})
      RETURNING id, name, emoji, created_at
    `;
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
