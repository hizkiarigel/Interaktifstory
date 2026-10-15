import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, clearLoginFailures, clientIp, loginLocked, recordLoginFailure } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { COOKIE, cookieOptions, createToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const locked = loginLocked(ip);
  if (locked > 0) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(locked / 60000)} menit.` },
      { status: 429 }
    );
  }
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const ok = await checkCredentials(String(body.email || ""), String(body.password || ""));
  if (!ok) {
    recordLoginFailure(ip);
    await logEvent("AD_Login_Error", null, null, { reason: "invalid" });
    return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
  }
  clearLoginFailures(ip);
  await logEvent("AD_Login_Button", null, null, null);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(), cookieOptions);
  return res;
}
