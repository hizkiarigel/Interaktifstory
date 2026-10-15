// Sesi pemilik: cookie bertanda tangan HMAC-SHA256 (Web Crypto, jalan di middleware & Node).
import { SESSION_DAYS } from "./config";

export const COOKIE = "tht_admin";

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = "";
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  try {
    return safeEqual(parts[2], await sign(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600,
};
