import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import type { Block, SceneKind } from "./parser";

export interface SceneRow {
  id: number;
  kind: SceneKind;
  number: number;
  title: string;
  metaTime: string | null;
  metaPlace: string | null;
  hint: string | null;
  blocks: Block[];
  image: { v: number; w: number; h: number } | null;
}

export interface EpisodeData {
  id: number;
  number: number;
  total: number;
  title: string;
  tagline: string;
  setting: string;
  arcProgress: string;
  genres: string[];
  seriesTitle: string;
  arcLabel: string;
  status: "draft" | "published";
  scenes: SceneRow[];
}

async function loadScenes(episodeId: number): Promise<SceneRow[]> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.kind, s.number, s.title, s.meta_time, s.meta_place, s.image_hint, s.blocks_json,
            i.width AS iw, i.height AS ih, UNIX_TIMESTAMP(i.updated_at) AS iv
       FROM scenes s LEFT JOIN scene_images i ON i.scene_id = s.id
      WHERE s.episode_id = ? ORDER BY s.sort_order`,
    [episodeId]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    number: r.number,
    title: r.title,
    metaTime: r.meta_time,
    metaPlace: r.meta_place,
    hint: r.image_hint,
    blocks: JSON.parse(r.blocks_json),
    image: r.iv ? { v: Number(r.iv), w: r.iw, h: r.ih } : null,
  }));
}

async function toEpisode(r: RowDataPacket): Promise<EpisodeData> {
  return {
    id: r.id,
    number: r.number,
    total: r.total,
    title: r.title,
    tagline: r.tagline || "",
    setting: r.setting || "",
    arcProgress: r.arc_progress || "",
    genres: (r.genres || "").split("|").filter(Boolean),
    seriesTitle: r.series_title,
    arcLabel: r.arc_label,
    status: r.status,
    scenes: await loadScenes(r.id),
  };
}

const EP_SELECT = `SELECT e.*, s.title AS series_title, s.arc_label FROM episodes e JOIN series s ON s.id = e.series_id`;

export async function getEpisodeByNumber(n: number, opts: { includeDraft: boolean }): Promise<EpisodeData | null> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `${EP_SELECT} WHERE e.number = ? ${opts.includeDraft ? "" : "AND e.status = 'published'"} LIMIT 1`,
    [n]
  );
  return rows[0] ? toEpisode(rows[0]) : null;
}

export async function getEpisodeById(id: number): Promise<EpisodeData | null> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(`${EP_SELECT} WHERE e.id = ? LIMIT 1`, [id]);
  return rows[0] ? toEpisode(rows[0]) : null;
}

export async function latestPublishedNumber(): Promise<number | null> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT number FROM episodes WHERE status='published' ORDER BY number DESC LIMIT 1`
  );
  return rows[0]?.number ?? null;
}

export interface EpisodeSummary {
  id: number;
  number: number;
  total: number;
  title: string;
  status: "draft" | "published";
  sections: number;
  withImage: number;
  updatedAt: string;
}

export async function listEpisodes(): Promise<EpisodeSummary[]> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.number, e.total, e.title, e.status, e.updated_at,
            (SELECT COUNT(*) FROM scenes s WHERE s.episode_id = e.id) AS sections,
            (SELECT COUNT(*) FROM scenes s JOIN scene_images i ON i.scene_id = s.id WHERE s.episode_id = e.id) AS with_image
       FROM episodes e ORDER BY e.number DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    total: r.total,
    title: r.title,
    status: r.status,
    sections: Number(r.sections),
    withImage: Number(r.with_image),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}
