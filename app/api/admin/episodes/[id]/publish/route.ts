import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number(params.id);
  const { publish } = (await req.json().catch(() => ({}))) as { publish?: boolean };
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, (SELECT COUNT(*) FROM scenes s WHERE s.episode_id=e.id) AS total,
            (SELECT COUNT(*) FROM scenes s JOIN scene_images i ON i.scene_id=s.id WHERE s.episode_id=e.id) AS withImg
       FROM episodes e WHERE e.id=?`,
    [id]
  );
  if (!rows[0]) return NextResponse.json({ error: "Episode tidak ditemukan." }, { status: 404 });
  if (publish) {
    await pool.query(`UPDATE episodes SET status='published', published_at=COALESCE(published_at, NOW()) WHERE id=?`, [id]);
    await logEvent("IM_Publish_Button", id, null, null);
  } else {
    await pool.query(`UPDATE episodes SET status='draft' WHERE id=?`, [id]);
    await logEvent("IM_Unpublish_Button", id, null, null);
  }
  return NextResponse.json({ ok: true, missingImages: Number(rows[0].total) - Number(rows[0].withImg) });
}
