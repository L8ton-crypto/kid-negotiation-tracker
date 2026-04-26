import { NextResponse } from "next/server";
import { ensureDb, sql } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const kidsRaw = await sql`SELECT id, name FROM kn_kids`;
    const countRaw = await sql`SELECT COUNT(*)::text AS n FROM kn_kids`;
    const allRaw = await sql`SELECT * FROM kn_kids LIMIT 5`;
    const dbHost = (process.env.DATABASE_URL || "").replace(/.*@/, "").replace(/[/?].*/, "");
    return NextResponse.json({
      _debug: {
        dbHost,
        count: countRaw,
        kidsRaw,
        allRaw,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
