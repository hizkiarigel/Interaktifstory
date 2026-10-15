import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { getEpisodeById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const ep = await getEpisodeById(id);
  if (!ep) notFound();
  return <Reader episode={ep} preview />;
}
