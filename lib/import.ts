import type { RowDataPacket } from "mysql2";
import { MAIN_CHARACTERS } from "./config";
import { db } from "./db";
import { parseEpisode, sceneKey, sortOrderOf, type EpisodeHeader, type ParsedEpisode } from "./parser";

export interface ImportPreview {
  parsed: ParsedEpisode;
  existing: { id: number; status: string } | null;
  keptImages: number;
  removed: { key: string; title: string; hasImage: boolean }[];
  added: string[];
}

async function headerOf(episodeId: number): Promise<EpisodeHeader | null> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.*, s.title AS series_title, s.arc_label FROM episodes e JOIN series s ON s.id = e.series_id WHERE e.id = ?`,
    [episodeId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    seriesTitle: r.series_title, arcLabel: r.arc_label, number: r.number, total: r.total, title: r.title,
    tagline: r.tagline || "", setting: r.setting || "", arcProgress: r.arc_progress || "",
    genres: (r.genres || "").split("|").filter(Boolean),
  };
}

/** appendTo: id episode tujuan untuk mode "tambah scene" (tanpa menghapus scene lain). */
export async function previewImport(text: string, appendTo?: number): Promise<ImportPreview> {
  const fallback = appendTo ? await headerOf(appendTo) : null;
  if (appendTo && !fallback) throw new Error("Episode tujuan tidak ditemukan.");
  const parsed = parseEpisode(text, MAIN_CHARACTERS, fallback ? { fallback } : {});
  const pool = await db();
  const [eps] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.status FROM episodes e JOIN series s ON s.id = e.series_id WHERE s.title = ? AND e.number = ?`,
    [parsed.seriesTitle, parsed.number]
  );
  const existing = eps[0] ? { id: eps[0].id as number, status: eps[0].status as string } : null;
  const newKeys = new Set(parsed.scenes.map((s) => sceneKey(s.kind, s.number)));
  let keptImages = 0;
  const removed: ImportPreview["removed"] = [];
  const added: string[] = [];
  if (existing) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.kind, s.number, s.title, (i.id IS NOT NULL) AS has_image
         FROM scenes s LEFT JOIN scene_images i ON i.scene_id = s.id WHERE s.episode_id = ?`,
      [existing.id]
    );
    const oldKeys = new Set<string>();
    for (const r of rows) {
      const k = sceneKey(r.kind, r.number);
      oldKeys.add(k);
      if (newKeys.has(k)) {
        if (r.has_image) keptImages++;
      } else if (!appendTo) removed.push({ key: k, title: r.title, hasImage: !!r.has_image });
    }
    for (const k of newKeys) if (!oldKeys.has(k)) added.push(k);
  }
  return { parsed, existing, keptImages, removed, added };
}

export class NeedsConfirmation extends Error {
  constructor(public removed: ImportPreview["removed"]) {
    super("Ada bagian yang akan dihapus.");
  }
}

/** Simpan sebagai Draft. Bagian dicocokkan lewat (episode, jenis, nomor) agar gambar tetap terpasang. */
export async function saveImport(text: string, confirmRemove: boolean, appendTo?: number) {
  const pv = await previewImport(text, appendTo);
  if (pv.removed.length > 0 && !confirmRemove) throw new NeedsConfirmation(pv.removed);
  const p = pv.parsed;
  const pool = await db();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO series (title, arc_label) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE arc_label = VALUES(arc_label)`,
      [p.seriesTitle, p.arcLabel]
    );
    const [[serie]] = (await conn.query<RowDataPacket[]>(`SELECT id FROM series WHERE title = ?`, [p.seriesTitle])) as [RowDataPacket[], unknown];
    const genres = p.genres.join("|");
    if (appendTo) {
      await conn.query(
        `UPDATE episodes SET source_text = CONCAT(COALESCE(source_text, ''), '\n\n', ?) WHERE id = ?`,
        [text, appendTo]
      );
    } else {
      await conn.query(
        `INSERT INTO episodes (series_id, number, total, title, tagline, setting, arc_progress, genres, status, source_text)
         VALUES (?,?,?,?,?,?,?,?, 'draft', ?)
         ON DUPLICATE KEY UPDATE total=VALUES(total), title=VALUES(title), tagline=VALUES(tagline),
           setting=VALUES(setting), arc_progress=VALUES(arc_progress), genres=VALUES(genres), source_text=VALUES(source_text)`,
        [serie.id, p.number, p.total, p.title, p.tagline, p.setting, p.arcProgress, genres, text]
      );
    }
    const [[ep]] = (await conn.query<RowDataPacket[]>(`SELECT id FROM episodes WHERE series_id=? AND number=?`, [serie.id, p.number])) as [RowDataPacket[], unknown];

    for (const r of pv.removed) {
      const [kind, num] = r.key.startsWith("scene-") ? ["scene", Number(r.key.slice(6))] : [r.key, 1];
      await conn.query(`DELETE FROM scenes WHERE episode_id=? AND kind=? AND number=?`, [ep.id, kind, num]);
    }
    const seen = new Set<string>();
    for (const s of p.scenes) {
      const key = sceneKey(s.kind, s.number);
      if (seen.has(key)) continue; // bagian ganda: hanya yang pertama
      seen.add(key);
      await conn.query(
        `INSERT INTO scenes (episode_id, kind, number, title, meta_time, meta_place, image_hint, blocks_json, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), meta_time=VALUES(meta_time), meta_place=VALUES(meta_place),
           image_hint=VALUES(image_hint), blocks_json=VALUES(blocks_json), sort_order=VALUES(sort_order)`,
        [ep.id, s.kind, s.number, s.title, s.metaTime, s.metaPlace, s.hint, JSON.stringify(s.blocks), sortOrderOf(s.kind, s.number)]
      );
    }
    await conn.commit();
    return { episodeId: ep.id as number, keptImages: pv.keptImages, removedSections: pv.removed.length, parsed: p };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
