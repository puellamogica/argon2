import { Redis } from "@upstash/redis";
import type { SignatureResult } from "@/lib/types";

const TIMESTAMP_WINDOW_SECONDS = 60;
const NONCE_TTL_SECONDS = 120;
const REDIS_ATTEMPT_TIMEOUT_MS = 3_000;
const REDIS_RETRIES = 2;
const MAX_SIGNATURE_BYTES = 64;
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class RedisReservationError extends Error {
  constructor(
    message: string,
    readonly retries: number,
  ) {
    super(message);
    this.name = "RedisReservationError";
  }
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Uint8Array.from(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

export function buildSignedMessage(
  timestamp: string,
  nonce: string,
  body: Uint8Array,
): Uint8Array {
  const prefix = new TextEncoder().encode(`${timestamp}\n${nonce}\n`);
  const message = new Uint8Array(prefix.length + body.length);
  message.set(prefix);
  message.set(body, prefix.length);
  return message;
}

export async function verifyRequestSignature(
  headers: Headers,
  body: Uint8Array,
  now = Math.floor(Date.now() / 1000),
): Promise<SignatureResult> {
  const publicKey = process.env.ED25519_PUBLIC_KEY;
  if (!publicKey) return { valid: false, reason: "misconfigured" };

  const timestamp = headers.get("x-request-timestamp");
  const nonce = headers.get("x-request-nonce");
  const encodedSignature = headers.get("x-request-signature");
  const timestampNumber = timestamp === null ? NaN : Number(timestamp);

  if (
    !timestamp ||
    !Number.isSafeInteger(timestampNumber) ||
    Math.abs(now - timestampNumber) > TIMESTAMP_WINDOW_SECONDS ||
    !nonce ||
    !UUID_V4_RE.test(nonce) ||
    !encodedSignature
  ) {
    return { valid: false, reason: "invalid" };
  }

  const signature = decodeBase64Url(encodedSignature);
  const keyBytes = decodeBase64Url(publicKey);
  if (!signature || signature.length !== MAX_SIGNATURE_BYTES || !keyBytes) {
    return { valid: false, reason: "invalid" };
  }

  try {
    const key = await crypto.subtle.importKey(
      "spki",
      asArrayBuffer(keyBytes),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      asArrayBuffer(signature),
      asArrayBuffer(buildSignedMessage(timestamp, nonce, body)),
    );

    return valid ? { valid: true, nonce } : { valid: false, reason: "invalid" };
  } catch {
    return { valid: false, reason: "misconfigured" };
  }
}

export async function reserveNonce(
  nonce: string,
): Promise<{ reserved: boolean; retries: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Replay protection is not configured");

  const key = `argon2:replay:${nonce}`;
  const reservationToken = crypto.randomUUID();
  for (let retries = 0; ; retries += 1) {
    try {
      // A fresh client gives each diagnostic attempt its own abort signal.
      const redisClient = new Redis({
        url,
        token,
        retry: { retries: 0 },
        enableAutoPipelining: false,
        signal: AbortSignal.timeout(REDIS_ATTEMPT_TIMEOUT_MS),
      });
      const result = await redisClient.set(key, reservationToken, {
        ex: NONCE_TTL_SECONDS,
        nx: true,
      });
      if (result === "OK") return { reserved: true, retries };

      if (retries > 0) {
        const currentToken = await redisClient.get<string>(key);
        return { reserved: currentToken === reservationToken, retries };
      }

      return { reserved: false, retries };
    } catch (error) {
      if (retries >= REDIS_RETRIES) {
        throw new RedisReservationError(
          error instanceof Error ? error.message : "Redis request failed",
          retries,
        );
      }
    }
  }
}

export const authConstants = {
  timestampWindowSeconds: TIMESTAMP_WINDOW_SECONDS,
  nonceTtlSeconds: NONCE_TTL_SECONDS,
  redisAttemptTimeoutMs: REDIS_ATTEMPT_TIMEOUT_MS,
  redisRetries: REDIS_RETRIES,
};
