import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { getEpisodeByNumber } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: { n: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = Number(params.n);
  const ep = Number.isInteger(n) ? await getEpisodeByNumber(n, { includeDraft: false }).catch(() => null) : null;
  if (!ep) return { title: "Episode tidak ditemukan" };
  return { title: `Episode ${ep.number}: ${ep.title}`, description: ep.tagline || undefined };
}

export default async function EpisodePage({ params }: Props) {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1) notFound();
  const ep = await getEpisodeByNumber(n, { includeDraft: false });
  if (!ep || ep.scenes.length === 0) notFound();
  return <Reader episode={ep} />;
}
