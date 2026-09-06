import * as argon2 from "argon2";
import type { VerifyResponse } from "@/lib/types";

const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2, // iterations
  parallelism: 1,
};

export async function verifyPassword(
  storedHash: string,
  userInput: string,
): Promise<VerifyResponse> {
  try {
    if (argon2.needsRehash(storedHash, ARGON2_OPTIONS)) {
      return { success: false, errcode: 7 };
    }

    const success = await argon2.verify(storedHash, userInput);
    return { success, errcode: success ? 0 : 8 };
  } catch {
    return { success: false, errcode: 9 };
  }
}
