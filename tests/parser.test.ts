import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEpisode, ScriptError } from "../lib/parser";

const sample = readFileSync(join(__dirname, "fixtures/sample-episode.txt"), "utf8");
const ep = parseEpisode(sample, ["ethan"]);
const byKey = (k: string, n = 1) => ep.scenes.find((s) => s.kind === k && s.number === n)!;

test("header dibaca", () => {
  assert.equal(ep.seriesTitle, "THE HIDDEN TYCOON");
  assert.equal(ep.arcLabel, "ARC 03 · THE ELITE CIRCLE");
  assert.equal(ep.number, 6);
  assert.equal(ep.total, 16);
  assert.equal(ep.title, "The Price of an Invitation");
  assert.match(ep.tagline, /^Satu malam .* tagihan\.$/);
  assert.equal(ep.setting, "Sehari setelah Asterion Winter Ball · New York City");
  assert.equal(ep.arcProgress, "06 / 16");
  assert.deepEqual(ep.genres, ["Romance", "K-Drama", "Business Thriller", "Mystery"]);
});

test("bagian: 3 scene + 4 penutup", () => {
  assert.deepEqual(
    ep.scenes.map((s) => (s.kind === "scene" ? `scene-${s.number}` : s.kind)),
    ["scene-1", "scene-2", "scene-3", "final", "status", "post", "next"]
  );
  assert.equal(ep.scenes[0].metaTime, "07:08 AM");
  assert.equal(ep.scenes[0].metaPlace, "Brooklyn · Ethan's apartment");
});

test("catatan produksi tidak tampil, VISUAL FINAL jadi petunjuk gambar", () => {
  const all = JSON.stringify(ep.scenes.map((s) => s.blocks));
  assert.ok(!all.includes("SIAPKAN"));
  assert.ok(!all.includes("VISUAL FINAL"));
  assert.match(byKey("scene", 1).hint || "", /EXTERIOR RAIN — Jendela apartemen/);
});

test("pesan HP jadi bubble, dialog langsung jadi baris", () => {
  const s1 = byKey("scene", 1);
  assert.equal(s1.phoneCount, 3);
  assert.equal(s1.dialogCount, 2);
  const phone = s1.blocks.find((b) => b.t === "phone");
  assert.ok(phone && phone.t === "phone");
  assert.equal(phone.title, "Aurele");
  assert.equal(phone.msgs[0].time, "07:09");
  assert.deepEqual(phone.msgs.map((m) => m.me), [false, true, false]);
  const whisper = s1.blocks.find((b) => b.t === "dialog" && b.dir === "berbisik");
  assert.ok(whisper && whisper.t === "dialog");
  assert.equal(whisper.speaker, "Ethan");
});

test("UNKNOWN selalu pesan HP; arahan mengakhiri pesan HP", () => {
  const s2 = byKey("scene", 2);
  assert.equal(s2.phoneCount, 1);
  assert.equal(s2.dialogCount, 1);
  const s3 = byKey("scene", 3);
  assert.equal(s3.phoneCount, 2);
  assert.equal(s3.dialogCount, 1);
});

test("feed, kotak sistem, email, panggilan, cut", () => {
  const b1 = byKey("scene", 1).blocks;
  const feed = b1.find((b) => b.t === "feed");
  assert.ok(feed && feed.t === "feed");
  assert.equal(feed.handle, "@asterionnews");
  assert.equal(feed.meta, "12.4K likes");
  assert.equal(feed.comments.length, 2);
  assert.ok(b1.some((b) => b.t === "system" && b.lines.length === 2));
  assert.ok(b1.some((b) => b.t === "call"));
  assert.ok(byKey("scene", 2).blocks.some((b) => b.t === "email"));
  assert.ok(byKey("scene", 2).blocks.some((b) => b.t === "cut"));
});

test("status akhir: karakter dan ledger terpisah di baris Item", () => {
  const rows = byKey("status").blocks.filter((b) => b.t === "rows");
  assert.equal(rows.length, 2);
  assert.ok(rows[0].t === "rows" && rows[0].variant === "characters" && rows[0].rows.length === 2);
  assert.ok(rows[1].t === "rows" && rows[1].variant === "ledger" && rows[1].rows.length === 3);
});

test("baris tak dikenal jadi narasi, tidak ada teks hilang", () => {
  const e = parseEpisode(
    "THE HIDDEN TYCOON\nARC 03 · X\nEPISODE 01/02 — T\nSCENE 01 — A\n07:00 AM · K · T\nBaris bebas apa saja: tanpa kutip\n"
  );
  assert.deepEqual(e.scenes[0].blocks, [{ t: "p", text: "Baris bebas apa saja: tanpa kutip" }]);
});

test("tanpa scene → pesan error yang ditentukan PRD", () => {
  assert.throws(() => parseEpisode("teks biasa tanpa scene"), (e: unknown) => {
    assert.ok(e instanceof ScriptError);
    assert.equal((e as Error).message, "Tidak ada scene ditemukan. Periksa format baris SCENE 01 — JUDUL.");
    return true;
  });
});
