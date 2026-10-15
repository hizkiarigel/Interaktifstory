import Link from "next/link";
import AdminTop from "@/components/AdminTop";
import { listEpisodes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  let episodes: Awaited<ReturnType<typeof listEpisodes>> = [];
  let dbError = "";
  try {
    episodes = await listEpisodes();
  } catch (e) {
    dbError = "Database tidak bisa dijangkau. Periksa variabel DB_* di pengaturan hosting.";
    console.error(e);
  }
  return (
    <>
      <AdminTop />
      <h1>Episode</h1>
      <p>
        <Link className="btn primary" href="/admin/import">
          + Impor naskah episode
        </Link>
      </p>
      {dbError && <p className="msg err">{dbError}</p>}
      {!dbError && episodes.length === 0 && <p className="muted">Belum ada episode. Impor naskah .txt untuk memulai.</p>}
      <div className="list">
        {episodes.map((e) => (
          <div key={e.id} className="card ep-row">
            <div>
              <strong>
                Episode {e.number}/{e.total} — {e.title}
              </strong>
              <div className="muted">
                {e.withImage}/{e.sections} scene sudah bergambar{e.withImage < e.sections ? ` · ${e.sections - e.withImage} kosong` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={`badge ${e.status === "published" ? "pub" : ""}`}>{e.status === "published" ? "Terbit" : "Draft"}</span>
              <Link className="btn sm" href={`/admin/episodes/${e.id}`}>
                Kelola
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
