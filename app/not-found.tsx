import Link from "next/link";

export default function NotFound() {
  return (
    <main className="plain">
      <h1>Episode tidak ditemukan</h1>
      <p>Tautan ini belum atau tidak lagi tersedia.</p>
      <Link href="/">Buka episode terbaru</Link>
    </main>
  );
}
