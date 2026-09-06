import { describe, expect, it } from "vitest";
import { parseBody, readBody } from "./validate";

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

describe("readBody", () => {
  it("reads bodies within the byte limit", async () => {
    const result = await readBody(
      new Request("https://example.com", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(result).toEqual({
      valid: true,
      body: new TextEncoder().encode("{}"),
    });
  });

  it("rejects a body over the byte limit before reading it", async () => {
    const result = await readBody(
      new Request("https://example.com", {
        method: "POST",
        headers: { "content-length": "1025" },
        body: "{}",
      }),
    );

    expect(result).toEqual({ valid: false, error: "Request body too large" });
  });

  it("rejects requests without a body", async () => {
    const result = await readBody(
      new Request("https://example.com", { method: "POST" }),
    );

    expect(result).toEqual({ valid: false, error: "Request body required" });
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
