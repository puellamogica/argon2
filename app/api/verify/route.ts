import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/argon2";
import {
  RedisReservationError,
  reserveNonce,
  verifyRequestSignature,
} from "@/lib/auth";
import { log } from "@/lib/logger";
import { parseBody, readBody } from "@/lib/validate";
import type { VerifyResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const bodyResult = await readBody(request);
    if (!bodyResult.valid) {
      log("validation_failed", { reason: bodyResult.error, ip, level: "warn" });
      const oversized = bodyResult.error === "Request body too large";
      return NextResponse.json(
        { success: false, errcode: oversized ? 1 : 4 },
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
        { success: false, errcode: configured ? 3 : 2 },
        { status: configured ? 503 : 401 },
      );
    }
    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bodyResult.body);
    } catch {
      log("validation_failed", { reason: "Invalid UTF-8", ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 4 }, { status: 400 });
    }
    const validation = parseBody(raw);

    if (!validation.valid) {
      log("validation_failed", { reason: validation.error, ip, level: "warn" });
      return NextResponse.json({ success: false, errcode: 4 }, { status: 400 });
    }

    let nonceReservation: {
      reserved: boolean;
      retries: number;
      ownershipConfirmed: boolean;
    };
    const redisStartedAt = performance.now();
    try {
      nonceReservation = await reserveNonce(signature.nonce);
    } catch (error) {
      const redisLatencyMs = Math.round(performance.now() - redisStartedAt);
      const retryCount =
        error instanceof RedisReservationError ? error.retries : 0;
      log("replay_store_failed", {
        reason: `${error instanceof Error ? error.message : "unknown"} (${redisLatencyMs}ms)`,
        ip,
        level: "error",
      });
      return NextResponse.json(
        { success: false, errcode: 5 },
        {
          status: 503,
          headers: {
            "X-Replay-Store-Latency-Ms": String(redisLatencyMs),
            "X-Replay-Store-Retry-Count": String(retryCount),
          },
        },
      );
    }
    const redisLatencyMs = Math.round(performance.now() - redisStartedAt);
    const replayHeaders = {
      "X-Replay-Store-Latency-Ms": String(redisLatencyMs),
      "X-Replay-Store-Retry-Count": String(nonceReservation.retries),
      "X-Replay-Store-Ownership-Confirmed": String(
        nonceReservation.ownershipConfirmed,
      ),
    };
    if (!nonceReservation.reserved) {
      log("replay_detected", { ip, level: "warn" });
      return NextResponse.json(
        { success: false, errcode: 6 },
        { status: 409, headers: replayHeaders },
      );
    }
    const result = await verifyPassword(
      validation.data.stored_hash,
      validation.data.user_input,
    );

    log("verify", { errcode: result.errcode, ip });

    if (result.errcode === 0) {
      return NextResponse.json(result, { status: 200, headers: replayHeaders });
    }

    if (result.errcode === 7) {
      return NextResponse.json(result, { status: 422, headers: replayHeaders });
    }

    if (result.errcode === 8) {
      return NextResponse.json(result, { status: 401, headers: replayHeaders });
    }

    return NextResponse.json(result, { status: 500, headers: replayHeaders });
  } catch (error) {
    log("error", {
      reason: error instanceof Error ? error.message : "unknown",
      ip,
      level: "error",
    });
    return NextResponse.json({ success: false, errcode: 9 }, { status: 500 });
  }
}
