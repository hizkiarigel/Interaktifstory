import type { RowDataPacket } from "mysql2";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new NextResponse("Not found", { status: 404 });
  const small = req.nextUrl.searchParams.get("s") === "sm";
  const pool = await db();
  const [meta] = await pool.query<RowDataPacket[]>(
    `SELECT e.status, UNIX_TIMESTAMP(i.updated_at) AS v, i.mime
       FROM scene_images i JOIN scenes s ON s.id=i.scene_id JOIN episodes e ON e.id=s.episode_id WHERE i.scene_id=?`,
    [id]
  );
  const m = meta[0];
  if (!m) return new NextResponse("Not found", { status: 404 });
  const admin = await isAdmin();
  if (m.status !== "published" && !admin) return new NextResponse("Not found", { status: 404 });

  const etag = `"${id}-${m.v}-${small ? "sm" : "lg"}"`;
  const cache = m.status === "published" && !admin ? "public, max-age=31536000, immutable" : "private, no-cache";
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${small ? "COALESCE(data_sm, data)" : "data"} AS d FROM scene_images WHERE scene_id=?`,
    [id]
  );
  const buf: Buffer | undefined = rows[0]?.d;
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": m.mime || "image/jpeg",
      "Content-Length": String(buf.length),
      ETag: etag,
      "Cache-Control": cache,
    },
  });
}
