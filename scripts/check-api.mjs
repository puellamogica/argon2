import argon2 from "argon2";
import { randomBytes, randomUUID, webcrypto } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const MAX_PROMPT_LENGTH = 16_384;
const API_TIMEOUT_MS = 15_000;
const PASSWORD_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("The private key must be unpadded base64url.");
  }
  return Buffer.from(value, "base64url");
}

function createTemporaryPassword() {
  const bytes = randomBytes(32);
  return Array.from(bytes, (byte) =>
    PASSWORD_CHARACTERS.charAt(byte % PASSWORD_CHARACTERS.length),
  ).join("");
}

async function promptSecret(label) {
  if (!input.isTTY || !input.setRawMode) {
    const reader = createInterface({ input, output });
    const answer = await reader.question(label);
    reader.close();
    return answer.trim();
  }

  output.write(label);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      input.setRawMode(false);
      input.removeListener("data", onData);
      output.write("\n");
    };

    const onData = (chunk) => {
      const characters = String(chunk);
      for (const character of characters) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value.trim());
          return;
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
        } else if (value.length < MAX_PROMPT_LENGTH) {
          value += character;
        }
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  const reader = createInterface({ input, output });
  const endpoint = (await reader.question("Endpoint URL: ")).trim();
  reader.close();

  const serviceToken = await promptSecret("Service token (hidden): ");
  const privateKeyBase64 = await promptSecret(
    "Ed25519 PKCS8 private key, base64url (hidden): ",
  );

  const endpointUrl = new URL(endpoint);
  if (!/^https?:$/.test(endpointUrl.protocol)) {
    throw new Error("Endpoint URL must use http or https.");
  }
  if (!serviceToken || !privateKeyBase64) {
    throw new Error("Service token and private key are required.");
  }

  const password = createTemporaryPassword();
  const storedHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const body = JSON.stringify({
    user_input: password,
    stored_hash: storedHash,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signedMessage = new TextEncoder().encode(
    `${timestamp}\n${nonce}\n${body}`,
  );
  const privateKey = await webcrypto.subtle.importKey(
    "pkcs8",
    base64UrlToBytes(privateKeyBase64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await webcrypto.subtle.sign("Ed25519", privateKey, signedMessage),
  ).toString("base64url");

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Timestamp": timestamp,
      "X-Request-Nonce": nonce,
      "X-Request-Signature": signature,
      "X-Service-Token": serviceToken,
    },
    body,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const responseBody = await response.text();

  console.log(`HTTP ${response.status}`);
  console.log(responseBody);

  let result;
  try {
    result = JSON.parse(responseBody);
  } catch {
    result = null;
  }

  if (!response.ok || result?.success !== true || result?.errcode !== 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Request failed.");
  process.exitCode = 1;
}
