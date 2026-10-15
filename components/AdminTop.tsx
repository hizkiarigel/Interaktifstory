"use client";

import Link from "next/link";

export default function AdminTop() {
  return (
    <div className="adm-top">
      <strong>The Hidden Tycoon · Admin</strong>
      <nav>
        <Link href="/admin">Episode</Link>
        <Link href="/admin/import">Impor</Link>
        <button
          className="btn sm"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            location.href = "/admin/login";
          }}
        >
          Keluar
        </button>
      </nav>
    </div>
  );
}
