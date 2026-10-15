import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { READER_EVENTS } from "@/lib/events";

export const runtime = "nodejs";

// Event anonim: hanya id acak per browser, tanpa nama/email. Selalu balas 204 agar pembaca tidak terganggu.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 2000) return new NextResponse(null, { status: 204 });
    const b = JSON.parse(raw) as { a?: string; n?: string; e?: number; s?: string; p?: Record<string, unknown> };
    if (!b.n || !READER_EVENTS.has(b.n) || !b.a || !/^[a-z0-9-]{8,40}$/i.test(b.a)) return new NextResponse(null, { status: 204 });
    const pool = await db();
    let episodeId: number | null = null;
    if (Number.isInteger(b.e)) {
      const [r] = await pool.query<RowDataPacket[]>(`SELECT id FROM episodes WHERE number=? AND status='published' LIMIT 1`, [b.e]);
      episodeId = r[0]?.id ?? null;
    }
    await pool.query(
      `INSERT INTO analytics_events (anon_id, name, episode_id, scene_key, props_json) VALUES (?,?,?,?,?)`,
      [b.a, b.n, episodeId, (b.s || "").slice(0, 40) || null, b.p ? JSON.stringify(b.p).slice(0, 500) : null]
    );
  } catch {
    /* diabaikan */
  }
  return new NextResponse(null, { status: 204 });
}
