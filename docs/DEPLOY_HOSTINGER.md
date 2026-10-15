# Deploy ke Hostinger

Butuh paket Hostinger yang mendukung **Node.js** (Business Web Hosting / Cloud / VPS). Shared hosting PHP biasa tidak bisa.

1. hPanel → Websites → Add website → **Node.js Apps** → impor dari GitHub repo ini (branch yang dipilih).
   Build command `npm run build`, start command `npm start`, Node 20 atau 22.
2. Environment variables (panel Hostinger, tempel apa adanya):
   - `DB_HOST=localhost`, `DB_PORT=3306`
   - `DB_NAME=u711122796_novelhkgroup18`, `DB_USER=u711122796_novelhkgroup`, `DB_PASSWORD=<password database>`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (dari `npm run hash -- "kata-sandi"`), `SESSION_SECRET` (≥ 32 karakter acak)
   - `MAIN_CHARACTERS=Ethan`
3. Deploy, buka `/admin`, login, impor naskah, unggah gambar, Terbitkan.

Catatan:
- Database dan aplikasi di akun hosting yang sama → `DB_HOST=localhost`. Dari luar Hostinger, alamat IP harus di-allow di Remote MySQL.
- Database baru 1 MB: gambar tersimpan di tabel `scene_images` (LONGBLOB). Satu gambar ≈ 100–500 KB (+ versi 900 px), jadi 15 gambar ≈ beberapa MB per episode. Pantau kuota database.
- Batas percobaan login disimpan di memori proses (reset saat aplikasi restart).
