import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { ImageError, processImage, saveSceneImage, IMAGE_ERROR_TEXT } from "@/lib/images";
import { sceneKey } from "@/lib/parser";

export const runtime = "nodejs";
export const maxDuration = 60;

async function sceneInfo(id: number) {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT id, episode_id, kind, number FROM scenes WHERE id=?`, [id]);
  return rows[0];
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const scene = await sceneInfo(Number(params.id));
  if (!scene) return NextResponse.json({ error: "Scene tidak ditemukan." }, { status: 404 });
  const t0 = Date.now();
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {}
  if (!file) return NextResponse.json({ error: IMAGE_ERROR_TEXT }, { status: 400 });
  const key = sceneKey(scene.kind, scene.number);
  try {
    const img = await processImage(Buffer.from(await file.arrayBuffer()));
    await saveSceneImage(scene.id, img);
    await logEvent("GB_Upload_Button", scene.episode_id, key, { bytes: img.data.length, duration_ms: Date.now() - t0 });
    return NextResponse.json({ ok: true, bytes: img.data.length, width: img.width, height: img.height, v: Math.floor(Date.now() / 1000) });
  } catch (e) {
    if (e instanceof ImageError) {
      await logEvent("GB_Upload_Error", scene.episode_id, key, { reason: "invalid_file" });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    await logEvent("GB_Upload_Error", scene.episode_id, key, { reason: "save_failed" });
    return NextResponse.json({ error: "Gagal menyimpan. Coba lagi." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const scene = await sceneInfo(Number(params.id));
  if (!scene) return NextResponse.json({ error: "Scene tidak ditemukan." }, { status: 404 });
  const pool = await db();
  await pool.query(`DELETE FROM scene_images WHERE scene_id=?`, [scene.id]);
  await logEvent("GB_Delete_Button", scene.episode_id, sceneKey(scene.kind, scene.number), null);
  return NextResponse.json({ ok: true });
}
