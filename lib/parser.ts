// Parser naskah episode (.txt) sesuai Lampiran D PRD.
// Murni fungsi (tanpa DB/IO) supaya mudah diuji.

export type SceneKind = "scene" | "final" | "status" | "post" | "next";

export type PhoneMsg = { from: string; text: string; me: boolean; time?: string };

export type Block =
  | { t: "p"; text: string }
  | { t: "dialog"; speaker: string; dir?: string; text: string }
  | { t: "phone"; title?: string; msgs: PhoneMsg[] }
  | { t: "call"; text: string }
  | { t: "feed"; handle: string; meta: string; body: string; comments: { user: string; text: string }[] }
  | { t: "system"; title: string; lines: string[] }
  | { t: "email"; subject: string }
  | { t: "caps"; text: string }
  | { t: "cut"; text: string }
  | { t: "rows"; variant: "characters" | "ledger"; rows: string[][] };

export interface ParsedScene {
  kind: SceneKind;
  number: number;
  title: string;
  metaTime: string | null;
  metaPlace: string | null;
  hint: string | null;
  blocks: Block[];
  phoneCount: number;
  dialogCount: number;
}

export interface ParsedEpisode {
  seriesTitle: string;
  arcLabel: string;
  number: number;
  total: number;
  title: string;
  tagline: string;
  setting: string;
  arcProgress: string;
  genres: string[];
  scenes: ParsedScene[];
  warnings: string[];
  totals: { sections: number; phone: number; dialog: number };
}

export class ScriptError extends Error {}

const DASH = "[—–\\-]";
const Q_OPEN = "[“\"‟„]";
const Q_CLOSE = "[”\"]";

const RE_SCENE = new RegExp(`^SCENE\\s+(\\d{1,3})\\s*${DASH}\\s*(.+)$`, "i");
const RE_FINAL = new RegExp(`^FINAL SHOT\\b\\s*(?:${DASH}\\s*(.*))?$`, "i");
const RE_STATUS = new RegExp(`^END-OF-EPISODE STATUS\\b\\s*(?:${DASH}\\s*(.*))?$`, "i");
const RE_POST = new RegExp(`^POST-CREDIT\\s*${DASH}\\s*(.+)$`, "i");
const RE_NEXT = new RegExp(`^NEXT\\s*${DASH}\\s*EPISODE\\s+(\\d+)\\s*/\\s*(\\d+)`, "i");
const RE_EPISODE = new RegExp(`^EPISODE\\s+(\\d+)\\s*/\\s*(\\d+)\\s*${DASH}\\s*(.+)$`, "i");
const RE_ARC = /^ARC\s+(\d+)\s*·\s*(.+)$/i;
const RE_ARC_PROGRESS = /^ARC PROGRESS\s+(\d+)\s*\/\s*(\d+)/i;
const RE_META = /^(\d{1,2}:\d{2}\s*[AP]M)\s*·\s*(.+)$/i;
const RE_VISUAL = /^VISUAL FINAL\s+(\d+)\s*·\s*(.+)$/i;
const RE_SIAPKAN = /^SIAPKAN\b/i;
const RE_DIALOG = new RegExp(
  `^([\\p{Lu}][\\p{L}\\p{N}.'’]*(?:\\s+[\\p{L}\\p{N}.'’]+){0,2})(?:,\\s*([^:“"‟„]{1,40}?))?:\\s*${Q_OPEN}(.+?)${Q_CLOSE}\\s*$`,
  "u"
);
const RE_PHONE_HEADER = /^(\p{L}[\p{L}\p{N}.'’ ]{0,29}?)\s+[—–-]\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*$/iu;
const RE_GROUP_CHAT = /^(.{0,40}?Group Chat)\s*$/i;
const RE_PHONE_CUE = /(Pesan dari|mengetik|muncul pesan|menyiapkan pesan|membalas|menambahkan:)/i;
const RE_CALL = /\s[—–-]\s(Incoming Call|Dad)\s*$/i;
const RE_SUBJECT = /^Subject:\s*(.+)$/i;
const RE_FEED_HEAD = /^(@[\w.]+)(?:\s*[·|]\s*(.+))?$/;
const RE_FEED_COMMENT = /^(@[\w.]+):\s*(.+)$/;
const RE_SYSTEM = /^EYE OF VALUE\s*·\s*(.+)$/i;
const RE_CUT = /^CUT TO BLACK\.?$/i;
const RE_CAPS = /^[^a-z]{8,}$/;

function norm(raw: string): string[] {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""));
}

const isBlank = (l: string | undefined) => l === undefined || l.trim() === "";

function detectKind(line: string): { kind: SceneKind; number: number; title: string } | null {
  let m = line.match(RE_SCENE);
  if (m) return { kind: "scene", number: parseInt(m[1], 10), title: m[2].trim() };
  if ((m = line.match(RE_FINAL))) return { kind: "final", number: 1, title: (m[1] || "").trim() || "Final Shot" };
  if ((m = line.match(RE_STATUS))) return { kind: "status", number: 1, title: (m[1] || "").trim() || "Status Akhir" };
  if ((m = line.match(RE_POST))) return { kind: "post", number: 1, title: m[1].trim() };
  if ((m = line.match(RE_NEXT))) return { kind: "next", number: 1, title: `Episode ${m[1]}/${m[2]}` };
  return null;
}

export function sceneKey(kind: SceneKind, number: number): string {
  return kind === "scene" ? `scene-${number}` : kind;
}

export function parseEpisode(raw: string, mainCharacters: string[] = ["ethan"]): ParsedEpisode {
  const lines = norm(raw);
  const warnings: string[] = [];

  const firstIdx = lines.findIndex((l) => detectKind(l.trim())?.kind === "scene");
  if (firstIdx === -1) {
    throw new ScriptError('Tidak ada scene ditemukan. Periksa format baris SCENE 01 — JUDUL.');
  }

  // ---------- Header ----------
  const head = lines.slice(0, firstIdx).map((l) => l.trim()).filter(Boolean);
  const epIdx = head.findIndex((l) => RE_EPISODE.test(l));
  if (epIdx === -1) throw new ScriptError('Baris header "EPISODE 06/16 — JUDUL" tidak ditemukan.');
  const epM = head[epIdx].match(RE_EPISODE)!;
  const number = parseInt(epM[1], 10);
  const total = parseInt(epM[2], 10);
  const title = epM[3].trim();

  const arcLine = head.find((l) => RE_ARC.test(l));
  const progIdx = head.findIndex((l) => RE_ARC_PROGRESS.test(l));
  let seriesTitle = head.find((l, i) => i < epIdx && !RE_ARC.test(l)) || "";
  if (!seriesTitle) {
    seriesTitle = "The Hidden Tycoon";
    warnings.push("Judul seri tidak ditemukan di baris pertama; dipakai \"The Hidden Tycoon\".");
  }
  if (!arcLine) warnings.push('Baris "ARC NN · NAMA" tidak ditemukan.');

  const between = head.slice(epIdx + 1, progIdx === -1 ? undefined : progIdx);
  let tagline = "";
  let setting = "";
  if (between.length >= 2) {
    setting = between[between.length - 1];
    tagline = between.slice(0, -1).join(" ");
  } else if (between.length === 1) {
    if (between[0].includes("·")) setting = between[0];
    else tagline = between[0];
  } else {
    warnings.push("Tagline dan lokasi tidak ditemukan di header.");
  }
  let arcProgress = `${number} / ${total}`;
  let genres: string[] = [];
  if (progIdx === -1) {
    warnings.push('Baris "ARC PROGRESS n / N" tidak ditemukan.');
  } else {
    const pm = head[progIdx].match(RE_ARC_PROGRESS)!;
    arcProgress = `${pm[1]} / ${pm[2]}`;
    const g = head[progIdx + 1];
    if (g) genres = g.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
    else warnings.push("Genre tidak ditemukan setelah ARC PROGRESS.");
  }

  // ---------- Badan ----------
  const scenes: ParsedScene[] = [];
  const hints = new Map<number, string>();
  let cur: ParsedScene | null = null;
  let phoneMode = false;
  let curPhone: Extract<Block, { t: "phone" }> | null = null;
  let pendingTime: string | undefined;
  let ledgerMode = false;

  const push = (b: Block) => {
    cur!.blocks.push(b);
    if (b.t !== "phone") curPhone = null;
  };
  const endPhone = () => {
    phoneMode = false;
    curPhone = null;
    pendingTime = undefined;
  };
  const addPhoneMsg = (from: string, text: string) => {
    const me = mainCharacters.includes(from.trim().toLowerCase());
    if (!curPhone) {
      curPhone = { t: "phone", msgs: [] };
      cur!.blocks.push(curPhone);
    }
    curPhone.msgs.push({ from, text, me, ...(pendingTime ? { time: pendingTime } : {}) });
    pendingTime = undefined;
    cur!.phoneCount++;
  };

  for (let i = firstIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Catatan produksi (tidak tampil ke pembaca)
    if (RE_SIAPKAN.test(line)) continue;
    const vis = line.match(RE_VISUAL);
    if (vis) {
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      const extra = j < lines.length && !detectKind(lines[j].trim()) ? lines[j].trim() : "";
      hints.set(parseInt(vis[1], 10), `${vis[2].trim()}${extra ? " — " + extra : ""}`);
      if (extra) i = j;
      continue;
    }

    // Awal bagian baru
    const k = detectKind(line);
    if (k) {
      endPhone();
      ledgerMode = false;
      cur = { ...k, metaTime: null, metaPlace: null, hint: null, blocks: [], phoneCount: 0, dialogCount: 0 };
      scenes.push(cur);
      if (k.kind === "scene") {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        const mm = j < lines.length ? lines[j].trim().match(RE_META) : null;
        if (mm) {
          cur.metaTime = mm[1].toUpperCase().replace(/\s+/g, " ");
          cur.metaPlace = mm[2].trim();
          i = j;
        }
      }
      continue;
    }
    if (!cur) continue;

    // Status akhir: baris bertab
    if (cur.kind === "status" && rawLine.includes("\t")) {
      const cells = rawLine.split("\t").map((c) => c.trim());
      if (/^item$/i.test(cells[0])) ledgerMode = true;
      const variant = ledgerMode ? "ledger" : "characters";
      const last = cur.blocks[cur.blocks.length - 1];
      if (last && last.t === "rows" && last.variant === variant) last.rows.push(cells);
      else cur.blocks.push({ t: "rows", variant, rows: [cells] });
      continue;
    }

    if (RE_CUT.test(line)) {
      endPhone();
      push({ t: "cut", text: line });
      continue;
    }

    // Kotak sistem
    const sys = line.match(RE_SYSTEM);
    if (sys) {
      endPhone();
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !isBlank(lines[j]) && !detectKind(lines[j].trim())) body.push(lines[j++].trim());
      push({ t: "system", title: `EYE OF VALUE · ${sys[1].trim()}`, lines: body });
      i = j - 1;
      continue;
    }

    // Kartu feed
    const fh = line.match(RE_FEED_HEAD);
    if (fh) {
      endPhone();
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      let meta = fh[2]?.trim() || "";
      if (!meta && j < lines.length && !RE_FEED_COMMENT.test(lines[j].trim())) meta = lines[j++].trim();
      const bodyLines: string[] = [];
      while (j < lines.length && !isBlank(lines[j]) && !RE_FEED_COMMENT.test(lines[j].trim()) && !detectKind(lines[j].trim())) {
        bodyLines.push(lines[j++].trim());
      }
      const comments: { user: string; text: string }[] = [];
      let c = j;
      while (c < lines.length) {
        if (isBlank(lines[c])) {
          // komentar boleh dipisah baris kosong, selama masih berpola komentar
          let n = c;
          while (n < lines.length && isBlank(lines[n])) n++;
          if (n < lines.length && RE_FEED_COMMENT.test(lines[n].trim())) {
            c = n;
            continue;
          }
          break;
        }
        const cm = lines[c].trim().match(RE_FEED_COMMENT);
        if (!cm) break;
        comments.push({ user: cm[1], text: cm[2].trim() });
        c++;
      }
      push({ t: "feed", handle: fh[1], meta, body: bodyLines.join(" "), comments });
      i = c - 1;
      continue;
    }

    // Email
    const sub = line.match(RE_SUBJECT);
    if (sub) {
      endPhone();
      push({ t: "email", subject: sub[1].trim() });
      continue;
    }

    // Akhir pesan HP: panggilan masuk
    if (RE_CALL.test(line) && !RE_DIALOG.test(line)) {
      endPhone();
      push({ t: "call", text: line });
      continue;
    }

    // Header pesan HP
    const ph = line.match(RE_PHONE_HEADER);
    if (ph) {
      phoneMode = true;
      curPhone = { t: "phone", title: ph[1].trim(), msgs: [] };
      cur.blocks.push(curPhone);
      pendingTime = ph[2];
      continue;
    }
    const gc = line.match(RE_GROUP_CHAT);
    if (gc) {
      phoneMode = true;
      curPhone = { t: "phone", title: gc[1].trim(), msgs: [] };
      cur.blocks.push(curPhone);
      pendingTime = undefined;
      continue;
    }

    // Dialog
    const d = line.match(RE_DIALOG);
    if (d) {
      const speaker = d[1].trim();
      const dir = d[2]?.trim();
      const text = d[3].trim();
      const unknown = speaker.toUpperCase() === "UNKNOWN";
      if (unknown || (phoneMode && !dir)) {
        phoneMode = true;
        addPhoneMsg(speaker, text);
      } else {
        endPhone();
        cur.dialogCount++;
        push({ t: "dialog", speaker, ...(dir ? { dir } : {}), text });
      }
      continue;
    }

    // Narasi
    if (RE_PHONE_CUE.test(line)) {
      phoneMode = true;
      curPhone = null;
      pendingTime = undefined;
      cur.blocks.push({ t: "p", text: line });
      continue;
    }
    if (RE_CAPS.test(line) && /[A-Z]/.test(line) && line.length >= 12) {
      endPhone();
      push({ t: "caps", text: line });
      continue;
    }
    push({ t: "p", text: line });
  }

  // petunjuk gambar untuk admin
  for (const s of scenes) {
    if (s.kind === "scene" && hints.has(s.number)) s.hint = hints.get(s.number)!;
  }

  // validasi ringan
  const seen = new Set<string>();
  for (const s of scenes) {
    const key = sceneKey(s.kind, s.number);
    if (seen.has(key)) warnings.push(`Bagian ganda: ${key}. Hanya satu yang akan tersimpan.`);
    seen.add(key);
  }
  const nums = scenes.filter((s) => s.kind === "scene").map((s) => s.number);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) warnings.push(`Nomor scene melompat dari ${nums[i - 1]} ke ${nums[i]}.`);
  }
  for (const s of scenes) {
    if (s.kind === "scene" && !s.metaTime) warnings.push(`Scene ${String(s.number).padStart(2, "0")} tidak punya baris jam · kota · tempat.`);
    if (s.blocks.length === 0) warnings.push(`${s.kind === "scene" ? "Scene " + String(s.number).padStart(2, "0") : s.title} kosong.`);
  }

  return {
    seriesTitle,
    arcLabel: arcLine || "",
    number,
    total,
    title,
    tagline,
    setting,
    arcProgress,
    genres,
    scenes,
    warnings,
    totals: {
      sections: scenes.length,
      phone: scenes.reduce((a, s) => a + s.phoneCount, 0),
      dialog: scenes.reduce((a, s) => a + s.dialogCount, 0),
    },
  };
}
