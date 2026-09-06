import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/argon2";
import { reserveNonce, verifyRequestSignature } from "@/lib/auth";
import { log } from "@/lib/logger";
import { parseBody, readBody } from "@/lib/validate";
import type { VerifyResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const startedAt = Date.now();

  try {
    const bodyResult = await readBody(request);
    if (!bodyResult.valid) {
      log("validation_failed", { reason: bodyResult.error, ip, level: "warn" });
      const oversized = bodyResult.error === "Request body too large";
      return NextResponse.json(
        { success: false, errcode: oversized ? 2 : 3 },
        { status: oversized ? 413 : 400 },
      );
    }

    const signature = await verifyRequestSignature(
      request.headers,
      bodyResult.body,
    );
    if (!signature.valid) {
      const configured = signature.reason === "misconfigured";
      log("auth_failed", {
        reason: configured ? "server_misconfigured" : "invalid_signature",
        ip,
        level: "warn",
      });
      return NextResponse.json(
        { success: false, errcode: configured ? 8 : 1 },
        { status: configured ? 503 : 401 },
      );
    }
    log("request_phase", {
      phase: "signature_verified",
      duration_ms: Date.now() - startedAt,
      ip,
    });

    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bodyResult.body);
    } catch {
      log("validation_failed", { reason: "Invalid UTF-8", ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 3 }, { status: 400 });
    }
    const validation = parseBody(raw);

    if (!validation.valid) {
      log("validation_failed", { reason: validation.error, ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 3 }, { status: 400 });
    }

    let nonceReserved: boolean;
    try {
      nonceReserved = await reserveNonce(signature.nonce);
    } catch (error) {
      log("replay_store_failed", {
        reason: error instanceof Error ? error.message : "unknown",
        ip,
        level: "error",
      });
      return NextResponse.json({ success: false, errcode: 8 }, { status: 503 });
    }
    if (!nonceReserved) {
      log("replay_detected", { ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 7 }, { status: 409 });
    }
    log("request_phase", {
      phase: "nonce_reserved",
      duration_ms: Date.now() - startedAt,
      ip,
    });

    log("request_phase", {
      phase: "argon2_started",
      duration_ms: Date.now() - startedAt,
      ip,
    });
    const result = await verifyPassword(
      validation.data.stored_hash,
      validation.data.user_input,
    );

    log("verify", { errcode: result.errcode, ip });

    if (result.errcode === 0) {
      return NextResponse.json(result, { status: 200 });
    }

    if (result.errcode === 4) {
      return NextResponse.json(result, { status: 422 });
    }

    if (result.errcode === 5) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result, { status: 500 });
  } catch (error) {
    log("error", {
      reason: error instanceof Error ? error.message : "unknown",
      duration_ms: Date.now() - startedAt,
      ip,
      level: "error",
    });
    return NextResponse.json({ success: false, errcode: 6 }, { status: 500 });
  }
}
