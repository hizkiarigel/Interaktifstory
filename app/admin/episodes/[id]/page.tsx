import Link from "next/link";
import { notFound } from "next/navigation";
import AdminTop from "@/components/AdminTop";
import EpisodeManager from "@/components/EpisodeManager";
import { getEpisodeById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EpisodeAdmin({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const ep = await getEpisodeById(id);
  if (!ep) notFound();
  return (
    <>
      <AdminTop />
      <p style={{ margin: "12px 0 0" }}>
        <Link href="/admin">← Semua episode</Link>
      </p>
      <h1>
        Episode {ep.number}/{ep.total} — {ep.title}
      </h1>
      <EpisodeManager
        episodeId={ep.id}
        number={ep.number}
        initialStatus={ep.status}
        scenes={ep.scenes.map((s) => ({
          id: s.id,
          kind: s.kind,
          number: s.number,
          title: s.title,
          metaTime: s.metaTime,
          hint: s.hint,
          v: s.image?.v ?? null,
        }))}
      />
    </>
  );
}
