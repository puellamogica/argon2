import type { VerifyRequestBody } from "@/app/api/verify/types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: VerifyRequestBody;
}

export function validateVerifyRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { user_input, stored_hash } = body as Record<string, unknown>;

  if (typeof user_input !== "string" || user_input.length === 0) {
    return { valid: false, error: "user_input is required" };
  }

  if (typeof stored_hash !== "string" || stored_hash.length === 0) {
    return { valid: false, error: "stored_hash is required" };
  }

  if (!stored_hash.startsWith("$argon2")) {
    return { valid: false, error: "Invalid hash format" };
  }

  return {
    valid: true,
    data: { user_input, stored_hash },
  };
}
