import argon2 from "argon2";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "./argon2";

const TEST_PASSWORD = "Passw0rd!";

const HASH = await argon2.hash(TEST_PASSWORD, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

const OFF_POLICY_HASH = await argon2.hash(TEST_PASSWORD, {
  type: argon2.argon2id,
  memoryCost: 8,
  timeCost: 1,
  parallelism: 1,
});

describe("verifyPassword", () => {
  it("verifies a correct password", async () => {
    await expect(verifyPassword(HASH, TEST_PASSWORD)).resolves.toEqual({
      success: true,
      errcode: 0,
    });
  });

  it("rejects a wrong password", async () => {
    await expect(verifyPassword(HASH, "Wrong1!")).resolves.toEqual({
      success: false,
      errcode: 8,
    });
  });

  it("rejects hashes with non-policy parameters before verifying", async () => {
    await expect(
      verifyPassword(OFF_POLICY_HASH, TEST_PASSWORD),
    ).resolves.toEqual({
      success: false,
      errcode: 7,
    });
  });

  it("returns errcode 9 for malformed hashes", async () => {
    await expect(verifyPassword("not-a-hash", TEST_PASSWORD)).resolves.toEqual({
      success: false,
      errcode: 9,
    });
  });
});
