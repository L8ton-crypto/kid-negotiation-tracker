import { NextResponse } from "next/server";
import { ensureDb, sql, KnKid, KnDeal } from "@/lib/db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const kidsRaw = await sql`SELECT id, name, emoji, created_at FROM kn_kids`;
    const dealsRaw = await sql`
      SELECT id, kid_id, title, kid_promises, parent_promises,
             follow_up_date::text AS follow_up_date,
             status, notes, created_at, resolved_at
      FROM kn_deals
    `;
    const kids = (kidsRaw as unknown as KnKid[]).slice().sort((a, b) =>
      (a.created_at || "").localeCompare(b.created_at || "")
    );
    const deals = (dealsRaw as unknown as KnDeal[]).slice().sort((a, b) => {
      const ao = a.status === "open" ? 0 : 1;
      const bo = b.status === "open" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const ad = a.follow_up_date ?? "9999-99-99";
      const bd = b.follow_up_date ?? "9999-99-99";
      if (ad !== bd) return ad.localeCompare(bd);
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    return NextResponse.json({ kids, deals });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
