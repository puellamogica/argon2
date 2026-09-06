import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authConstants,
  buildSignedMessage,
  reserveNonce,
  verifyRequestSignature,
} from "./auth";

const body = new TextEncoder().encode('{"user_input":"Passw0rd!"}');
const timestamp = "1700000000";
const nonce = "550e8400-e29b-41d4-a716-446655440000";

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function signedHeaders(privateKey: KeyObject) {
  const message = buildSignedMessage(timestamp, nonce, body);
  const signature = sign(null, message, privateKey);
  return new Headers({
    "x-request-timestamp": timestamp,
    "x-request-nonce": nonce,
    "x-request-signature": base64Url(signature),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ED25519_PUBLIC_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("verifyRequestSignature", () => {
  it("verifies the timestamp, nonce, and exact body", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.ED25519_PUBLIC_KEY = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64url");

    await expect(
      verifyRequestSignature(signedHeaders(privateKey), body, 1700000000),
    ).resolves.toEqual({ valid: true, nonce });
  });

  it("rejects a changed body", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.ED25519_PUBLIC_KEY = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64url");

    await expect(
      verifyRequestSignature(
        signedHeaders(privateKey),
        new TextEncoder().encode('{"user_input":"Wrong1!"}'),
        1700000000,
      ),
    ).resolves.toEqual({ valid: false, reason: "invalid" });
  });

  it("rejects timestamps outside the 60-second window", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.ED25519_PUBLIC_KEY = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64url");

    await expect(
      verifyRequestSignature(signedHeaders(privateKey), body, 1700000061),
    ).resolves.toEqual({ valid: false, reason: "invalid" });
  });

  it("reports missing configuration separately", async () => {
    await expect(
      verifyRequestSignature(new Headers(), body, 1700000000),
    ).resolves.toEqual({ valid: false, reason: "misconfigured" });
  });
});

describe("reserveNonce", () => {
  it("uses an atomic one-time Redis SET with an expiry", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com/";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: "OK" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(reserveNonce(nonce)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example.com/set/argon2%3Areplay%3A550e8400-e29b-41d4-a716-446655440000/1/ex/" +
        `${authConstants.nonceTtlSeconds}/nx`,
      {
        headers: { Authorization: "Bearer token" },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("returns false when Redis reports an existing nonce", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ result: null }), { status: 200 }),
        ),
    );

    await expect(reserveNonce(nonce)).resolves.toBe(false);
  });
});
