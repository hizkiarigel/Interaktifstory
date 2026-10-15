import { db } from "./db";

export const READER_EVENTS = new Set([
  "RD_Episode_Page",
  "RD_Scene_View",
  "RD_Image_Load",
  "RD_Image_Error",
  "RD_Episode_Complete",
  "RD_SceneList_Button",
  "RD_SceneNav_Button",
]);

/** Event admin dicatat dari server (tanpa data pribadi). Gagal mencatat tidak boleh mengganggu. */
export async function logEvent(name: string, episodeId: number | null, sceneKey: string | null, props: unknown, anonId = "owner") {
  try {
    const pool = await db();
    await pool.query(
      `INSERT INTO analytics_events (anon_id, name, episode_id, scene_key, props_json) VALUES (?,?,?,?,?)`,
      [anonId.slice(0, 40), name, episodeId, sceneKey, props ? JSON.stringify(props).slice(0, 1000) : null]
    );
  } catch {
    /* diabaikan */
  }
}
