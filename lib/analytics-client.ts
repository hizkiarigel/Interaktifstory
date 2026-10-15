// Event anonim: id acak per browser, tanpa nama/email. Gagal kirim tidak pernah mengganggu pembaca.
function anonId(): string {
  try {
    let id = localStorage.getItem("tht_anon");
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 36);
      localStorage.setItem("tht_anon", id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 12);
  }
}

export function track(name: string, episodeNo: number, sceneKey?: string, props?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ a: anonId(), n: name, e: episodeNo, s: sceneKey, p: props });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    /* diabaikan */
  }
}
