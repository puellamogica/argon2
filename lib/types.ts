export interface VerifyRequestBody {
  user_input: string;
  stored_hash: string;
}

export interface VerifyResponse {
  success: boolean;
  errcode: number;
}

export type BodyReadResult =
  | { valid: true; body: Uint8Array }
  | {
      valid: false;
      error: "Request body too large" | "Request body required";
    };

export type SignatureResult =
  | { valid: true; nonce: string }
  | { valid: false; reason: "invalid" | "misconfigured" };
