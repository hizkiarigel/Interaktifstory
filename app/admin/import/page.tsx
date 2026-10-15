import type { RowDataPacket } from "mysql2";
import AdminTop from "@/components/AdminTop";
import ImportForm from "@/components/ImportForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: { from?: string } }) {
  let initial = "";
  const from = Number(searchParams.from);
  if (Number.isInteger(from)) {
    const pool = await db();
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT source_text FROM episodes WHERE id=?`, [from]);
    initial = rows[0]?.source_text || "";
  }
  return (
    <>
      <AdminTop />
      <h1>Impor naskah</h1>
      <p className="muted">
        Tempel teks episode atau unggah file .txt. Impor ulang episode yang sama mempertahankan gambar bagian yang cocok.
      </p>
      <ImportForm initialText={initial} />
    </>
  );
}
