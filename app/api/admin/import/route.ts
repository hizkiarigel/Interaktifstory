import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { NeedsConfirmation, previewImport, saveImport } from "@/lib/import";
import { ScriptError } from "@/lib/parser";

export const runtime = "nodejs";

function summary(p: Awaited<ReturnType<typeof previewImport>>["parsed"]) {
  return {
    seriesTitle: p.seriesTitle,
    number: p.number,
    total: p.total,
    title: p.title,
    totals: p.totals,
    warnings: p.warnings,
    scenes: p.scenes.map((s) => ({
      kind: s.kind,
      number: s.number,
      title: s.title,
      metaTime: s.metaTime,
      phone: s.phoneCount,
      dialog: s.dialogCount,
    })),
  };
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let body: { text?: string; mode?: "preview" | "save"; confirmRemove?: boolean; appendTo?: number } = {};
  try {
    body = await req.json();
  } catch {}
  const text = String(body.text || "");
  const appendTo = Number.isInteger(body.appendTo) ? body.appendTo : undefined;
  if (!text.trim()) return NextResponse.json({ error: "Naskah kosong." }, { status: 400 });
  if (text.length > 2_000_000) return NextResponse.json({ error: "Naskah terlalu besar." }, { status: 413 });

  try {
    if (body.mode === "save") {
      const r = await saveImport(text, !!body.confirmRemove, appendTo);
      await logEvent(r.keptImages || r.removedSections ? "IM_Reimport_Button" : "IM_Import_Button", r.episodeId, null, {
        sections: r.parsed.totals.sections,
        warnings: r.parsed.warnings.length,
        kept_images: r.keptImages,
        removed_sections: r.removedSections,
      });
      return NextResponse.json({ ok: true, episodeId: r.episodeId, keptImages: r.keptImages, summary: summary(r.parsed) });
    }
    const pv = await previewImport(text, appendTo);
    return NextResponse.json({
      summary: summary(pv.parsed),
      existing: pv.existing,
      keptImages: pv.keptImages,
      removed: pv.removed,
      added: pv.added,
    });
  } catch (e) {
    if (e instanceof NeedsConfirmation) {
      return NextResponse.json({ error: "Perlu konfirmasi penghapusan.", needsConfirm: true, removed: e.removed }, { status: 409 });
    }
    if (e instanceof ScriptError) {
      await logEvent("IM_Import_Error", null, null, { reason: e.message });
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan. Coba lagi." }, { status: 500 });
  }
}
