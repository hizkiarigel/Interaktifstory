import { redirect } from "next/navigation";
import { latestPublishedNumber } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const n = await latestPublishedNumber();
  if (n) redirect(`/episode/${n}`);
  return (
    <main className="plain">
      <h1>The Hidden Tycoon</h1>
      <p>Belum ada episode yang terbit.</p>
    </main>
  );
}
