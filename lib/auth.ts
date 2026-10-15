import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifyToken } from "./session";

export async function isAdmin(): Promise<boolean> {
  return verifyToken(cookies().get(COOKIE)?.value);
}

/** Dipakai semua API tulis: sesi pemilik + perlindungan CSRF (cek Origin). */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (!(await verifyToken(req.cookies.get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Perlu login." }, { status: 401 });
  }
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (origin) {
      let oh = "";
      try {
        oh = new URL(origin).host;
      } catch {}
      if (oh !== host) return NextResponse.json({ error: "Permintaan ditolak." }, { status: 403 });
    }
  }
  return null;
}

// ---- Batas percobaan login: 5 kali salah → kunci 15 menit (per alamat IP) ----
const attempts = new Map<string, { n: number; first: number; lockedUntil: number }>();
const WINDOW = 15 * 60 * 1000;

export function loginLocked(ip: string): number {
  const a = attempts.get(ip);
  if (a && a.lockedUntil > Date.now()) return a.lockedUntil - Date.now();
  return 0;
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || now - a.first > WINDOW) a = { n: 0, first: now, lockedUntil: 0 };
  a.n++;
  if (a.n >= 5) a.lockedUntil = now + WINDOW;
  attempts.set(ip, a);
}

export function clearLoginFailures(ip: string) {
  attempts.delete(ip);
}

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const wantEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  // bandingkan hash selalu, agar waktu respons tidak membocorkan mana yang salah
  const okPass = hash ? await bcrypt.compare(password, hash) : false;
  const okEmail = wantEmail !== "" && email.trim().toLowerCase() === wantEmail;
  return okPass && okEmail;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
