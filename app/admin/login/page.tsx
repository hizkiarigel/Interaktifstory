"use client";

import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        location.href = "/admin";
        return;
      }
      setError(j.error || "Gagal masuk.");
    } catch {
      setError("Tidak bisa terhubung. Coba lagi.");
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 380, margin: "12vh auto 0" }}>
      <h1>Masuk pemilik</h1>
      <p className="muted">The Hidden Tycoon Reader</p>
      <form onSubmit={submit} className="card">
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          Kata sandi
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="msg err" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
