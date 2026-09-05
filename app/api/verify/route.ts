import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/argon2";
import { log } from "@/lib/logger";
import { verifyApiKey, parseBody } from "@/lib/validate";
import type { VerifyResponse } from "./types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const apiKey = request.headers.get("x-api-key");
    const envKey = process.env.API_KEY;

    if (!apiKey || !envKey || !verifyApiKey(apiKey, envKey)) {
      log("auth_failed", { reason: "invalid_key", ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 1 }, { status: 401 });
    }

    const raw = await request.text();
    const validation = parseBody(raw);

    if (!validation.valid) {
      log("validation_failed", { reason: validation.error, ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 2 }, { status: 400 });
    }

    const result = await verifyPassword(
      validation.data!.stored_hash,
      validation.data!.user_input,
    );

    log("verify", { errcode: result.errcode, ip });

    if (result.errcode === 0) {
      return NextResponse.json(result, { status: 200 });
    }

    if (result.errcode === 3) {
      return NextResponse.json(result, { status: 500 });
    }

    if (result.errcode === 4) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result, { status: 500 });
  } catch {
    log("error", { reason: "internal", ip, level: "error" });
    return NextResponse.json({ success: false, errcode: 5 }, { status: 500 });
  }
}
