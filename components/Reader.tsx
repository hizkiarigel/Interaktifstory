"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics-client";
import type { EpisodeData, SceneRow } from "@/lib/queries";
import { BlockView } from "./Blocks";

const LABEL: Record<string, string> = { final: "Final Shot", status: "Status Akhir", post: "Post-Credit", next: "Berikutnya" };

const keyOf = (s: SceneRow) => (s.kind === "scene" ? `scene-${s.number}` : s.kind);
const eyebrow = (s: SceneRow) =>
  s.kind === "scene" ? `Scene ${String(s.number).padStart(2, "0")}${s.metaTime ? ` · ${s.metaTime}` : ""}` : LABEL[s.kind];
const imgUrl = (s: SceneRow, small = false) => `/api/scenes/${s.id}/image?v=${s.image!.v}${small ? "&s=sm" : ""}`;

type ImgState = "ok" | "err";

export default function Reader({ episode, preview = false }: { episode: EpisodeData; preview?: boolean }) {
  const scenes = episode.scenes;
  const [active, setActive] = useState(0);
  const [stack, setStack] = useState(true);
  const [requested, setRequested] = useState<Set<number>>(() => new Set([0, 1]));
  const requestedRef = useRef<Set<number>>(new Set([0, 1]));
  const [imgState, setImgState] = useState<Record<number, ImgState>>({});
  const [listOpen, setListOpen] = useState(false);
  const [zoom, setZoom] = useState(false);

  const mediaRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLElement | null)[]>([]);
  const loadStart = useRef<Record<number, number>>({});
  const seen = useRef<Set<number>>(new Set());
  const completed = useRef(false);
  const stackRef = useRef(true);
  const userMoved = useRef(false);
  const activeRef = useRef(0);

  const ep = episode.number;

  // ---------- Layout: 1 kolom di lebar ≤ 720 px ----------
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => {
      stackRef.current = mq.matches;
      setStack(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    if (!preview) track("RD_Episode_Page", ep, undefined, { layout: mq.matches ? "stack" : "split" });
    return () => mq.removeEventListener("change", apply);
  }, [ep, preview]);

  // ---------- Scene aktif: judul scene melewati 40% tinggi panel ----------
  const compute = useCallback(() => {
    const media = mediaRef.current;
    const story = storyRef.current;
    if (!media || !story) return;
    const st = stackRef.current;
    // HP: gambar jadi latar penuh; scene baru aktif begitu hero-nya naik melewati 62% tinggi layar.
    // Lebar: judul scene melewati 40% tinggi panel cerita.
    const line = st ? window.innerHeight * 0.62 : story.getBoundingClientRect().top + 0.4 * story.clientHeight;
    let a = 0;
    for (let i = 0; i < heads.current.length; i++) {
      const el = heads.current[i];
      if (el && el.getBoundingClientRect().top <= line) a = i;
      else break;
    }
    const atBottom = st
      ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8
      : story.scrollTop + story.clientHeight >= story.scrollHeight - 8;
    if (atBottom && (st ? window.scrollY > 0 : story.scrollTop > 0)) {
      a = heads.current.length - 1;
      if (!completed.current) {
        completed.current = true;
        if (!preview) track("RD_Episode_Complete", ep);
      }
    }
    if (a !== activeRef.current) {
      activeRef.current = a;
      setActive(a);
    }
  }, [ep, preview]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      userMoved.current = true;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          compute();
        });
    };
    const target: HTMLElement | Window = stack ? window : storyRef.current!;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    compute();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stack, compute]);

  // ---------- Reaksi atas scene aktif: muat gambar (berikutnya lebih dulu), event, alamat ----------
  const request = useCallback(
    (idx: number[]) => {
      const fresh = idx.filter((i) => i >= 0 && i < scenes.length && !requestedRef.current.has(i));
      if (fresh.length === 0) return;
      const now = performance.now();
      fresh.forEach((i) => {
        requestedRef.current.add(i);
        loadStart.current[i] = now; // waktu mulai muat gambar (untuk RD_Image_Load)
      });
      setRequested(new Set(requestedRef.current));
    },
    [scenes.length]
  );

  // Gambar awal ikut HTML server: bisa selesai dimuat sebelum React aktif, sehingga onLoad/onError terlewat.
  // Periksa statusnya sekali saat mount.
  useEffect(() => {
    document.querySelectorAll<HTMLImageElement>(".frame img").forEach((img, k) => {
      const i = Number(img.dataset.i ?? k);
      if (img.complete && img.naturalWidth > 0) setImgState((p) => (p[i] ? p : { ...p, [i]: "ok" }));
      else if (img.complete) setImgState((p) => ({ ...p, [i]: "err" }));
    });
    loadStart.current[0] ??= performance.now();
    loadStart.current[1] ??= performance.now();
  }, []);

  useEffect(() => {
    request([active - 1, active, active + 1, active + 2]);
    if (!seen.current.has(active)) {
      seen.current.add(active);
      if (!preview) track("RD_Scene_View", ep, keyOf(scenes[active]));
    }
    if (userMoved.current) {
      try {
        history.replaceState(null, "", `#${keyOf(scenes[active])}`);
      } catch {}
    }
  }, [active, scenes, ep, preview, request]);

  // ---------- Navigasi ----------
  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = heads.current[i];
      if (!el) return;
      const behavior: ScrollBehavior = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";
      userMoved.current = true;
      if (stackRef.current) {
        window.scrollTo({ top: i === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY, behavior });
      } else {
        const st = storyRef.current!;
        st.scrollTo({ top: el.getBoundingClientRect().top - st.getBoundingClientRect().top + st.scrollTop - 24, behavior });
      }
    },
    []
  );

  // alamat langsung ke scene: /episode/6#scene-4 (nomor tak ada → buka dari awal tanpa error)
  useEffect(() => {
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.replace(/^#/, ""));
      if (!h) return;
      const i = scenes.findIndex((s) => keyOf(s) === h);
      if (i >= 0) {
        request([i - 1, i, i + 1, i + 2]);
        requestAnimationFrame(() => goTo(i, false));
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [scenes, goTo, request]);

  const step = (dir: 1 | -1) => {
    // mundur dari tengah scene dulu kembali ke awal scene itu
    let target = active + dir;
    if (dir === -1) {
      const el = heads.current[active];
      const ref = stackRef.current ? 0 : storyRef.current?.getBoundingClientRect().top || 0;
      if (el && el.getBoundingClientRect().top < ref - 40) target = active;
    }
    target = Math.max(0, Math.min(scenes.length - 1, target));
    if (!preview) track("RD_SceneNav_Button", ep, keyOf(scenes[target]), { direction: dir === 1 ? "next" : "prev" });
    goTo(target);
  };

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

  // lembar daftar scene: kunci scroll latar & tutup dengan Escape
  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setListOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [listOpen]);

  const cur = scenes[active];

  return (
    <div className={`reader ${stack ? "is-stack" : "is-split"}`}>
      <div className="media" ref={mediaRef} onClick={() => cur.image && imgState[active] === "ok" && setZoom(true)}>
        {scenes.map((s, i) => {
          const showImg = !!s.image && requested.has(i) && imgState[i] !== "err";
          return (
            <figure key={s.id} className={`frame ${i === active ? "on" : ""}`}>
              {showImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl(s)}
                  srcSet={`${imgUrl(s, true)} 900w, ${imgUrl(s)} 1800w`}
                  sizes="(max-width: 720px) 100vw, 50vw"
                  data-i={i}
                  alt={`Ilustrasi ${eyebrow(s)}: ${s.title}`}
                  decoding="async"
                  draggable={false}
                  onLoad={() => {
                    const t0 = loadStart.current[i];
                    if (t0 !== undefined && !preview) track("RD_Image_Load", ep, keyOf(s), { duration_ms: Math.round(performance.now() - t0) });
                    delete loadStart.current[i];
                    setImgState((p) => (p[i] === "ok" ? p : { ...p, [i]: "ok" }));
                  }}
                  onError={() => {
                    if (!preview) track("RD_Image_Error", ep, keyOf(s));
                    setImgState((p) => ({ ...p, [i]: "err" }));
                  }}
                />
              ) : null}
              {(!showImg || imgState[i] !== "ok") && (
                <div className="ph">
                  <span className="eyebrow">{eyebrow(s)}</span>
                  <strong>{s.title}</strong>
                </div>
              )}
            </figure>
          );
        })}
      </div>

      <div className="chip">
        EP {String(ep).padStart(2, "0")} · {active + 1}/{scenes.length}
      </div>
      {preview && (
        <Link href={`/admin/episodes/${episode.id}`} className="chip chip-r">
          ← Admin{episode.status === "draft" ? " · Draft" : ""}
        </Link>
      )}

      <main className="story" ref={storyRef}>
        <header className="cover" ref={(el) => void (heads.current[0] = el)} onClick={() => stackRef.current && cur.image && imgState[active] === "ok" && setZoom(true)}>
          <p className="eyebrow">{episode.seriesTitle}</p>
          <p className="arc">
            {episode.arcLabel} · Episode {episode.arcProgress}
          </p>
          <h1>{episode.title}</h1>
          {episode.tagline && <p className="tagline">{episode.tagline}</p>}
          {episode.setting && <p className="setting">{episode.setting}</p>}
          {episode.genres.length > 0 && (
            <ul className="genres">
              {episode.genres.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </header>

        {scenes.map((s, i) => {
          const head = (
            <>
              <p className="eyebrow">{eyebrow(s)}</p>
              {(s.kind === "scene" || (s.title && s.title.toLowerCase() !== LABEL[s.kind]?.toLowerCase())) && (
                <h2 id={`h-${keyOf(s)}`}>{s.title}</h2>
              )}
              {s.metaPlace && <p className="place">{s.metaPlace}</p>}
            </>
          );
          return (
            <section key={s.id} className={`scene kind-${s.kind}`} aria-labelledby={`h-${keyOf(s)}`}>
              {i > 0 && (
                <div
                  id={keyOf(s)}
                  className="hero"
                  ref={(el) => void (heads.current[i] = el)}
                  onClick={() => stackRef.current && s.image && imgState[i] === "ok" && setZoom(true)}
                >
                  <div className="hero-text">{head}</div>
                </div>
              )}
              <div className="panel">
                {i === 0 && (
                  <div id={keyOf(s)} className="anchor">
                    {head}
                  </div>
                )}
                {s.blocks.map((b, j) => (
                  <BlockView key={j} b={b} />
                ))}
              </div>
            </section>
          );
        })}
        <footer className="end">
          <p>{episode.seriesTitle}</p>
        </footer>
      </main>

      <nav className="bar" aria-label="Navigasi scene">
        <button type="button" onClick={() => step(-1)} disabled={active === 0} aria-label="Scene sebelumnya">
          ↑
        </button>
        <button
          type="button"
          className="list-btn"
          onClick={() => {
            if (!preview) track("RD_SceneList_Button", ep);
            setListOpen(true);
          }}
        >
          <span>{cur.kind === "scene" ? `Scene ${cur.number}` : LABEL[cur.kind]}</span>
          <small>Daftar · {active + 1}/{scenes.length}</small>
        </button>
        <button type="button" onClick={() => step(1)} disabled={active === scenes.length - 1} aria-label="Scene berikutnya">
          ↓
        </button>
      </nav>

      {zoom && cur.image && (
        <div className="zoom" role="dialog" aria-label="Gambar penuh" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl(cur)} alt={`Ilustrasi ${eyebrow(cur)}: ${cur.title}`} />
          <button type="button" aria-label="Tutup">✕</button>
        </div>
      )}

      {listOpen && (
        <div className="sheet-wrap" onClick={() => setListOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Daftar scene" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>Daftar scene</strong>
              <button type="button" onClick={() => setListOpen(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <ol>
              {scenes.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={i === active ? "cur" : ""}
                    autoFocus={i === active}
                    onClick={() => {
                      setListOpen(false);
                      setTimeout(() => goTo(i), 30);
                    }}
                  >
                    <span className="n">{s.kind === "scene" ? String(s.number).padStart(2, "0") : "•"}</span>
                    <span className="t">
                      {s.kind === "scene" ? s.title : LABEL[s.kind] + (s.kind === "post" || s.kind === "next" ? ` — ${s.title}` : "")}
                      {s.metaTime && <small>{s.metaTime}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
