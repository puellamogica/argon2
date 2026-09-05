import * as argon2 from "argon2";
import type { VerifyResponse } from "@/app/api/verify/types";

export async function verifyPassword(
  storedHash: string,
  userInput: string,
): Promise<VerifyResponse> {
  try {
    if (argon2.needsRehash(storedHash)) {
      return { success: false, errcode: 1 };
    }

    const success = await argon2.verify(storedHash, userInput);
    return { success, errcode: success ? 0 : 3 };
  } catch {
    return { success: false, errcode: 4 };
  }
}
