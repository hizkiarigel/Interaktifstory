import type { RowDataPacket } from "mysql2";
import AdminTop from "@/components/AdminTop";
import ImportForm from "@/components/ImportForm";
import { db } from "@/lib/db";
import { listEpisodes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: { from?: string } }) {
  let initial = "";
  const from = Number(searchParams.from);
  if (Number.isInteger(from)) {
    const pool = await db();
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT source_text FROM episodes WHERE id=?`, [from]);
    initial = rows[0]?.source_text || "";
  }
  const episodes = await listEpisodes().catch(() => []);
  return (
    <>
      <AdminTop />
      <h1>Impor naskah</h1>
      <p className="muted">
        Tempel teks episode atau unggah file .txt. Impor ulang episode yang sama mempertahankan gambar bagian yang cocok.
      </p>
      <ImportForm initialText={initial} episodes={episodes.map((e) => ({ id: e.id, number: e.number, title: e.title }))} />
    </>
  );
}
