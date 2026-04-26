import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let _client: NeonQueryFunction<false, false> | null = null;

function client() {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = neon(url);
  }
  return _client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return client()(strings, ...values);
}

let initPromise: Promise<void> | null = null;

export async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS kn_kids (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          emoji TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS kn_deals (
          id SERIAL PRIMARY KEY,
          kid_id INTEGER NOT NULL REFERENCES kn_kids(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          kid_promises TEXT,
          parent_promises TEXT,
          follow_up_date DATE,
          status TEXT NOT NULL DEFAULT 'open',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS kn_deals_kid_idx ON kn_deals(kid_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS kn_deals_status_idx ON kn_deals(status)
      `;
    })().catch((err) => {
      // Reset so a future request can retry
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export type KnKid = {
  id: number;
  name: string;
  emoji: string | null;
  created_at: string;
};

export type KnDeal = {
  id: number;
  kid_id: number;
  title: string;
  kid_promises: string | null;
  parent_promises: string | null;
  follow_up_date: string | null;
  status: "open" | "fulfilled" | "broken";
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
};
