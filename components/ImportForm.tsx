"use client";

import Link from "next/link";
import { useState } from "react";

type Summary = {
  seriesTitle: string;
  number: number;
  total: number;
  title: string;
  totals: { sections: number; phone: number; dialog: number };
  warnings: string[];
  scenes: { kind: string; number: number; title: string; metaTime: string | null; phone: number; dialog: number }[];
};
type Removed = { key: string; title: string; hasImage: boolean };
type Preview = { summary: Summary; existing: { id: number; status: string } | null; keptImages: number; removed: Removed[]; added: string[] };

export default function ImportForm({
  initialText = "",
  episodes = [],
}: {
  initialText?: string;
  episodes?: { id: number; number: number; title: string }[];
}) {
  const [target, setTarget] = useState<number>(0);
  const [text, setText] = useState(initialText);
  const [pv, setPv] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ episodeId: number; keptImages: number } | null>(null);

  async function call(mode: "preview" | "save", confirmRemove = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, confirmRemove, appendTo: target || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.needsConfirm) setError("");
        else setError(j.error || "Gagal.");
        return null;
      }
      return j;
    } catch {
      setError("Tidak bisa terhubung. Coba lagi.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    setSaved(null);
    setPv(null);
    const j = await call("preview");
    if (j) setPv(j);
  }
  async function onSave() {
    const j = await call("save", true);
    if (j) setSaved({ episodeId: j.episodeId, keptImages: j.keptImages });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setText(await f.text());
      setPv(null);
      setSaved(null);
    }
  }

  const s = pv?.summary;
  const destructive = (pv?.removed.length || 0) > 0;
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div>
      {episodes.length > 0 && (
        <div className="field">
          <label htmlFor="target">Tujuan</label>
          <select
            id="target"
            value={target}
            onChange={(e) => {
              setTarget(Number(e.target.value));
              setPv(null);
              setSaved(null);
            }}
          >
            <option value={0}>Impor / impor ulang sesuai header naskah</option>
            {episodes.map((e) => (
              <option key={e.id} value={e.id}>
                Tambahkan scene ke Episode {e.number} — {e.title} (tanpa menghapus scene lain)
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="file">File .txt</label>
        <input id="file" type="file" accept=".txt,text/plain" onChange={onFile} />
      </div>
      <div className="field">
        <label htmlFor="txt">Atau tempel teks episode</label>
        <textarea
          id="txt"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPv(null);
            setSaved(null);
          }}
          placeholder={'THE HIDDEN TYCOON\nARC 03 · …\nEPISODE 06/16 — …\n\nSCENE 01 — JUDUL\n07:08 AM · Kota · Tempat\n…'}
        />
      </div>
      <button className="btn primary" disabled={busy || !text.trim()} onClick={onPreview}>
        {busy && !pv ? "Membaca…" : "Pratinjau impor"}
      </button>
      {error && <p className="msg err" role="alert">{error}</p>}

      {s && !saved && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>
            Episode {s.number}/{s.total} — {s.title}
          </h2>
          <div className="stats">
            <div className="stat"><b>{s.totals.sections}</b>bagian</div>
            <div className="stat"><b>{s.totals.phone}</b>pesan HP</div>
            <div className="stat"><b>{s.totals.dialog}</b>dialog langsung</div>
            {pv!.existing && <div className="stat"><b>{pv!.keptImages}</b>gambar dipertahankan</div>}
          </div>
          {pv!.existing && <p className="msg">Episode ini sudah ada ({pv!.existing.status === "published" ? "Terbit" : "Draft"}). Impor ulang menimpa teks, gambar bagian yang cocok tetap terpasang.</p>}
          {s.warnings.length > 0 && (
            <div className="msg err">
              <strong>Peringatan ({s.warnings.length})</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {s.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {destructive && (
            <div className="msg err">
              <strong>Bagian ini akan dihapus bersama gambarnya:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {pv!.removed.map((r) => (
                  <li key={r.key}>
                    {r.key === "scene-" ? r.title : r.key.replace("scene-", "Scene ")} — {r.title}
                    {r.hasImage ? " (punya gambar)" : ""}
                  </li>
                ))}
              </ul>
              <label style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                Ya, hapus bagian di atas beserta gambarnya
              </label>
            </div>
          )}
          <table className="t">
            <thead>
              <tr><th>#</th><th>Judul</th><th>Jam</th><th>HP</th><th>Dialog</th></tr>
            </thead>
            <tbody>
              {s.scenes.map((sc) => (
                <tr key={`${sc.kind}${sc.number}`}>
                  <td>{sc.kind === "scene" ? String(sc.number).padStart(2, "0") : "•"}</td>
                  <td>{sc.title}</td>
                  <td>{sc.metaTime || ""}</td>
                  <td>{sc.phone}</td>
                  <td>{sc.dialog}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" disabled={busy || (destructive && !confirmed)} onClick={onSave}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
            <button className="btn" onClick={() => { setPv(null); setConfirmed(false); }}>Batal</button>
          </p>
        </div>
      )}

      {saved && (
        <div className="msg ok" style={{ marginTop: 16 }}>
          Tersimpan sebagai Draft{saved.keptImages ? ` · ${saved.keptImages} gambar tetap terpasang` : ""}.{" "}
          <Link href={`/admin/episodes/${saved.episodeId}`}>Kelola gambar & terbitkan →</Link>
        </div>
      )}
    </div>
  );
}
