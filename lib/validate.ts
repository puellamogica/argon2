import type { BodyReadResult, VerifyRequestBody } from "@/lib/types";

export type ValidationResult =
  { valid: true; data: VerifyRequestBody } | { valid: false; error: string };

const USER_INPUT_RE = /^[A-Za-z0-9!@#$%^&*]{5,128}$/;
const PHC_ARGON2_RE =
  /^\$argon2id\$v=\d+\$m=\d+,p=\d+,t=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;
const MAX_BODY_SIZE = 1024;

export async function readBody(request: Request): Promise<BodyReadResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
    return { valid: false, error: "Request body too large" };
  }

  if (!request.body) return { valid: false, error: "Request body required" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_SIZE) {
        await reader.cancel();
        return { valid: false, error: "Request body too large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { valid: true, body };
}

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

function validateVerifyRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { user_input, stored_hash } = body as Record<string, unknown>;

  if (typeof user_input !== "string" || !USER_INPUT_RE.test(user_input)) {
    return {
      valid: false,
      error: "user_input must be 5-128 characters of A-Z a-z 0-9 !@#$%^&*",
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
