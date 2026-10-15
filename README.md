# The Hidden Tycoon Reader

Web pembaca cerita bersambung (mobile-first). Layar HP: gambar scene menempel di atas, cerita di bawah, gambar berganti
saat judul scene melewati 40% tinggi panel. Layar lebar (> 720 px): dua kolom. Admin untuk impor naskah `.txt`,
unggah gambar per scene (disimpan di database MySQL), dan terbitkan.

Stack: Next.js 14 + TypeScript, `mysql2`, `sharp`. Tabel dibuat otomatis saat pertama kali dipakai.

## Menjalankan
```bash
cp .env.example .env     # isi DB_*, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET
npm install
npm run hash -- "kata-sandi-kamu"   # hasilnya ke ADMIN_PASSWORD_HASH
npm run dev              # atau: npm run build && npm start
npm test                 # unit test parser
```

## Alamat
- `/` → episode terbit terbaru · `/episode/6` · `/episode/6#scene-4`
- `/admin` (login) → Impor → Kelola gambar → Terbitkan

## Aturan naskah
Lihat Lampiran D di PRD; implementasi di `lib/parser.ts`, diuji di `tests/parser.test.ts`
(fixture `tests/fixtures/sample-episode.txt` adalah contoh sintetis, bukan naskah Episode 06 asli).
Tokoh utama (bubble HP di kanan) diatur lewat `MAIN_CHARACTERS`.

## Deploy
Lihat `docs/DEPLOY_HOSTINGER.md`.
