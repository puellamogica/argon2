import { describe, expect, it } from "vitest";
import { isValidApiKeyFormat, parseBody, verifyApiKey } from "./validate";

const VALID_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$B748yh9jSYIplNllhzBGqg$tWr/Kil3QLd2AocyPnFxk6t14Wn5SzWTT3/mRgGLvP8";

const body = (user_input: unknown, stored_hash: unknown = VALID_HASH) =>
  JSON.stringify({ user_input, stored_hash });

describe("parseBody", () => {
  it("accepts a valid request", () => {
    const result = parseBody(body("Passw0rd!"));
    expect(result).toEqual({
      valid: true,
      data: { user_input: "Passw0rd!", stored_hash: VALID_HASH },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseBody("not json")).toEqual({
      valid: false,
      error: "Invalid JSON",
    });
  });

  it("rejects oversized bodies", () => {
    expect(parseBody(body("a".repeat(1100)))).toEqual({
      valid: false,
      error: "Request body too large",
    });
  });

  it("rejects non-object bodies", () => {
    expect(parseBody("null").valid).toBe(false);
    expect(parseBody("[1,2]").valid).toBe(false);
    expect(parseBody('"str"').valid).toBe(false);
  });

  it("rejects missing or non-string fields", () => {
    expect(parseBody("{}").valid).toBe(false);
    expect(parseBody(body(null)).valid).toBe(false);
    expect(parseBody(body("Passw0rd!", 123)).valid).toBe(false);
  });
});

describe("user_input charset", () => {
  it("rejects input shorter than 5 characters", () => {
    expect(parseBody(body("abcd")).valid).toBe(false);
  });

  it("accepts exactly 5 characters", () => {
    expect(parseBody(body("abcde")).valid).toBe(true);
  });

  it("accepts exactly 128 characters", () => {
    expect(parseBody(body("a".repeat(128)))).toEqual({
      valid: true,
      data: { user_input: "a".repeat(128), stored_hash: VALID_HASH },
    });
  });

  it("rejects input longer than 128 characters", () => {
    expect(parseBody(body("a".repeat(129))).valid).toBe(false);
  });

  it("rejects characters outside the allowed set", () => {
    expect(parseBody(body("pass word")).valid).toBe(false);
    expect(parseBody(body("pässwörd")).valid).toBe(false);
    expect(parseBody(body("pass-word")).valid).toBe(false);
    expect(parseBody(body("pass.word")).valid).toBe(false);
  });

  it("accepts all allowed special characters", () => {
    expect(parseBody(body("a!@#$%^&*1"))).toEqual({
      valid: true,
      data: { user_input: "a!@#$%^&*1", stored_hash: VALID_HASH },
    });
  });
});

describe("stored_hash format", () => {
  it("rejects malformed hashes", () => {
    expect(parseBody(body("Passw0rd!", "not-a-hash")).valid).toBe(false);
    expect(parseBody(body("Passw0rd!", "$argon2i$")).valid).toBe(false);
    expect(
      parseBody(body("Passw0rd!", "$bcrypt$v=19$m=19456,p=1,t=2$salt$hash"))
        .valid,
    ).toBe(false);
  });

  it("rejects hashes with non-PHC structure", () => {
    expect(
      parseBody(body("Passw0rd!", "$argon2id$v=19$m=65536,p=4,t=3$c2FsdXQ"))
        .valid,
    ).toBe(false);
  });
});

describe("verifyApiKey", () => {
  const key = (c: string) => c.repeat(43);

  it("accepts matching keys", () => {
    expect(verifyApiKey(key("a"), key("a"))).toBe(true);
  });

  it("rejects mismatched keys", () => {
    expect(verifyApiKey(key("a"), key("b"))).toBe(false);
  });

  it("rejects malformed provided keys", () => {
    expect(verifyApiKey("a".repeat(42), key("a"))).toBe(false);
    expect(verifyApiKey("a".repeat(44), key("a"))).toBe(false);
    expect(verifyApiKey("a!".repeat(21) + "a", key("a"))).toBe(false);
    expect(verifyApiKey("", key("a"))).toBe(false);
  });

  it("rejects malformed expected keys", () => {
    expect(verifyApiKey(key("a"), "short")).toBe(false);
  });
});

describe("isValidApiKeyFormat", () => {
  it("accepts 43 base64url characters", () => {
    expect(isValidApiKeyFormat("a".repeat(43))).toBe(true);
    expect(isValidApiKeyFormat("A0_-".repeat(10) + "A0_")).toBe(true);
  });

  it("rejects other formats", () => {
    expect(isValidApiKeyFormat("your-api-key-here")).toBe(false);
    expect(isValidApiKeyFormat("a".repeat(43) + "!")).toBe(false);
  });
});
