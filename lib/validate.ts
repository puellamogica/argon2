import { timingSafeEqual } from "crypto";
import type { VerifyRequestBody } from "@/app/api/verify/types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: VerifyRequestBody;
}

const API_KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const USER_INPUT_RE = /^[A-Za-z0-9!@#$%^&*]+$/;
const PHC_ARGON2_RE =
  /^\$argon2id\$v=\d+\$m=\d+,p=\d+,t=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;
const MAX_BODY_SIZE = 1024;

export function parseBody(raw: string): ValidationResult {
  if (raw.length > MAX_BODY_SIZE) {
    return { valid: false, error: "Request body too large" };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { valid: false, error: "Invalid JSON" };
  }

  return validateVerifyRequest(body);
}

export function verifyApiKey(provided: string, expected: string): boolean {
  if (!API_KEY_RE.test(provided)) return false;
  if (!API_KEY_RE.test(expected)) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function validateVerifyRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { user_input, stored_hash } = body as Record<string, unknown>;

  if (typeof user_input !== "string" || !USER_INPUT_RE.test(user_input)) {
    return {
      valid: false,
      error: "user_input must contain only A-Z a-z 0-9 !@#$%^&*",
    };
  }

  if (typeof stored_hash !== "string" || !PHC_ARGON2_RE.test(stored_hash)) {
    return {
      valid: false,
      error: "stored_hash must be valid Argon2 PHC format",
    };
  }

  return {
    valid: true,
    data: { user_input, stored_hash },
  };
}
