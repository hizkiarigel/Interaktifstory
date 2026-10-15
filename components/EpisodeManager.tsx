"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type S = { id: number; kind: string; number: number; title: string; metaTime: string | null; hint: string | null; v: number | null };
const LABEL: Record<string, string> = { final: "Final Shot", status: "Status Akhir", post: "Post-Credit", next: "Berikutnya" };
const label = (s: S) => (s.kind === "scene" ? `Scene ${String(s.number).padStart(2, "0")}` : LABEL[s.kind]);
const MAX = 10 * 1024 * 1024;
const ERR_FILE = "Pakai JPG, PNG, atau WebP, maksimal 10 MB";

function naturalSort(a: File, b: File) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

async function upload(sceneId: number, file: File): Promise<{ ok: true; v: number } | { ok: false; error: string }> {
  if (file.size > MAX) return { ok: false, error: ERR_FILE };
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch(`/api/admin/scenes/${sceneId}/image`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, v: j.v || Math.floor(Date.now() / 1000) };
    return { ok: false, error: j.error || "Gagal menyimpan. Coba lagi." };
  } catch {
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
}

export default function EpisodeManager({
  episodeId,
  number,
  initialStatus,
  scenes: initial,
}: {
  episodeId: number;
  number: number;
  initialStatus: "draft" | "published";
  scenes: S[];
}) {
  const [scenes, setScenes] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<number | "pub" | "many" | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [errs, setErrs] = useState<Record<number, string>>({});
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [confirmPub, setConfirmPub] = useState(false);
  const [startAt, setStartAt] = useState(scenes[0]?.id ?? 0);
  const [results, setResults] = useState<{ name: string; ok: boolean; text: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number>(0);
  const manyRef = useRef<HTMLInputElement>(null);

  const missing = scenes.filter((s) => s.v === null).length;

  function pick(sceneId: number) {
    targetRef.current = sceneId;
    fileRef.current?.click();
  }

  async function onSingle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const id = targetRef.current;
    setBusy(id);
    setErrs((p) => ({ ...p, [id]: "" }));
    const r = await upload(id, f);
    if (r.ok) setScenes((p) => p.map((s) => (s.id === id ? { ...s, v: r.v } : s)));
    else setErrs((p) => ({ ...p, [id]: r.error }));
    setBusy(null);
  }

  async function onMany(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).sort(naturalSort);
    e.target.value = "";
    if (!files.length) return;
    setBusy("many");
    setResults([]);
    const startIdx = scenes.findIndex((s) => s.id === startAt);
    const out: { name: string; ok: boolean; text: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const target = scenes[startIdx + i];
      if (!target) {
        out.push({ name: files[i].name, ok: false, text: "Ditolak: tidak ada scene tersisa untuk file ini" });
      } else {
        const r = await upload(target.id, files[i]);
        if (r.ok) {
          setScenes((p) => p.map((s) => (s.id === target.id ? { ...s, v: r.v } : s)));
          out.push({ name: files[i].name, ok: true, text: `Terpasang di ${label(target)}` });
        } else out.push({ name: files[i].name, ok: false, text: `Gagal (${label(target)}): ${r.error}` });
      }
      setResults([...out]);
    }
    setBusy(null);
  }

  async function del(id: number) {
    setBusy(id);
    const r = await fetch(`/api/admin/scenes/${id}/image`, { method: "DELETE" });
    if (r.ok) setScenes((p) => p.map((s) => (s.id === id ? { ...s, v: null } : s)));
    else setErrs((p) => ({ ...p, [id]: "Gagal menghapus. Coba lagi." }));
    setConfirmDel(null);
    setBusy(null);
  }

  async function setPublished(publish: boolean) {
    setBusy("pub");
    setNote(null);
    const r = await fetch(`/api/admin/episodes/${episodeId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    if (r.ok) {
      setStatus(publish ? "published" : "draft");
      setNote({ kind: "ok", text: publish ? `Terbit. Tautan pembaca: ${location.origin}/episode/${number}` : "Ditarik kembali ke Draft." });
    } else setNote({ kind: "err", text: "Gagal mengubah status." });
    setConfirmPub(false);
    setBusy(null);
  }

  return (
    <div>
      <div className="card ep-row">
        <div>
          <span className={`badge ${status === "published" ? "pub" : ""}`}>{status === "published" ? "Terbit" : "Draft"}</span>{" "}
          <span className="muted">
            {scenes.length - missing}/{scenes.length} scene bergambar
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn sm" href={`/admin/episodes/${episodeId}/preview`} target="_blank">
            Pratinjau
          </Link>
          <Link className="btn sm" href={`/admin/import?from=${episodeId}`}>
            Impor ulang
          </Link>
          {status === "published" ? (
            <>
              <Link className="btn sm" href={`/episode/${number}`} target="_blank">
                Buka tautan
              </Link>
              <button className="btn sm danger" disabled={busy === "pub"} onClick={() => setPublished(false)}>
                Tarik
              </button>
            </>
          ) : confirmPub ? (
            <>
              <button className="btn sm primary" disabled={busy === "pub"} onClick={() => setPublished(true)}>
                Tetap terbitkan
              </button>
              <button className="btn sm" onClick={() => setConfirmPub(false)}>
                Batal
              </button>
            </>
          ) : (
            <button className="btn sm primary" onClick={() => (missing > 0 ? setConfirmPub(true) : setPublished(true))}>
              Terbitkan
            </button>
          )}
        </div>
      </div>
      {confirmPub && <p className="msg err">{missing} scene belum punya gambar dan akan tampil sebagai placeholder. Terbitkan tetap?</p>}
      {note && <p className={`msg ${note.kind}`}>{note.text}</p>}

      <h2>Unggah banyak gambar</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          File diurutkan menurut nama (angka: 1, 2, … 10) lalu dipasang berurutan mulai dari scene yang dipilih.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label className="muted" htmlFor="start">
            Mulai dari
          </label>
          <select id="start" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} style={{ padding: 8, borderRadius: 8 }}>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)} — {s.title}
              </option>
            ))}
          </select>
          <button className="btn primary sm" disabled={busy !== null} onClick={() => manyRef.current?.click()}>
            {busy === "many" ? "Mengunggah…" : "Pilih file"}
          </button>
          <input ref={manyRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onMany} />
        </div>
        {results.length > 0 && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: "0.88rem" }}>
            {results.map((r, i) => (
              <li key={i} style={{ color: r.ok ? "var(--ok)" : "var(--danger)" }}>
                {r.name} — {r.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2>Gambar per scene</h2>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onSingle} />
      <div className="scene-grid">
        {scenes.map((s) => (
          <div key={s.id} className="sc-card">
            <div className="sc-thumb">
              {s.v !== null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/scenes/${s.id}/image?v=${s.v}&s=sm`} alt={`Gambar ${label(s)}`} loading="lazy" />
              ) : (
                <span>Belum ada gambar</span>
              )}
            </div>
            <h3>
              {label(s)}{s.kind === "scene" ? ` · ${s.title}` : ""}
              {s.metaTime ? <span className="muted"> · {s.metaTime}</span> : null}
            </h3>
            {s.hint && <div className="hint">Petunjuk: {s.hint}</div>}
            <div className="sc-actions">
              {confirmDel === s.id ? (
                <>
                  <button className="btn sm danger" disabled={busy === s.id} onClick={() => del(s.id)}>
                    Ya, hapus gambar
                  </button>
                  <button className="btn sm" onClick={() => setConfirmDel(null)}>
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <button className="btn sm" disabled={busy !== null} onClick={() => pick(s.id)}>
                    {busy === s.id ? "Mengunggah…" : s.v !== null ? "Ganti gambar" : "Unggah gambar"}
                  </button>
                  {s.v !== null && (
                    <button className="btn sm danger" disabled={busy !== null} onClick={() => setConfirmDel(s.id)}>
                      Hapus gambar
                    </button>
                  )}
                </>
              )}
            </div>
            {errs[s.id] && <div className="msg err" role="alert" style={{ margin: 0 }}>{errs[s.id]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
