import argon2 from "argon2";
import { randomBytes, randomUUID, webcrypto } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const MAX_PROMPT_LENGTH = 16_384;
const API_TIMEOUT_MS = 15_000;
const BATCH_SIZES = [1, 5, 10, 25, 50, 75, 100];
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

async function createSignedRequests(count, privateKey, signal) {
  const requests = [];
  for (let attempt = 1; attempt <= count; attempt += 1) {
    if (signal.aborted) break;

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
    const signature = Buffer.from(
      await webcrypto.subtle.sign("Ed25519", privateKey, signedMessage),
    ).toString("base64url");

    requests.push({ attempt, body, nonce, signature, timestamp });
  }
  return requests;
}

async function sendRequests(endpointUrl, serviceToken, requests, controller) {
  const results = await Promise.all(
    requests.map(async ({ attempt, body, nonce, signature, timestamp }) => {
      try {
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
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(API_TIMEOUT_MS),
          ]),
        });
        const responseBody = await response.text();
        let result;
        try {
          result = JSON.parse(responseBody);
        } catch {
          result = null;
        }
        const passed =
          response.ok && result?.success === true && result?.errcode === 0;
        return {
          attempt,
          detail: passed
            ? "success"
            : `HTTP ${response.status}, errcode ${result?.errcode ?? "unknown"}`,
          passed,
        };
      } catch (error) {
        return {
          attempt,
          detail: error instanceof Error ? error.name : "Request failed",
          passed: false,
        };
      }
    }),
  );

  const failures = new Map();
  for (const result of results) {
    if (!result.passed) {
      failures.set(result.detail, (failures.get(result.detail) ?? 0) + 1);
    }
  }

  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failures,
  };
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

  const privateKey = await webcrypto.subtle.importKey(
    "pkcs8",
    base64UrlToBytes(privateKeyBase64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );

  const controller = new AbortController();
  const onInterrupt = () => {
    console.log("\nStopping requests...");
    controller.abort();
  };
  process.once("SIGINT", onInterrupt);

  try {
    const summaries = [];
    for (const batchSize of BATCH_SIZES) {
      if (controller.signal.aborted) break;
      console.log(
        `\nPreparing and sending ${batchSize} concurrent requests...`,
      );
      const requests = await createSignedRequests(
        batchSize,
        privateKey,
        controller.signal,
      );
      if (requests.length === 0) break;

      const summary = await sendRequests(
        endpointUrl,
        serviceToken,
        requests,
        controller,
      );
      summaries.push({ requested: batchSize, ...summary });
      console.log(
        `Batch ${batchSize}: ${summary.passed}/${summary.total} successful`,
      );
      for (const [detail, count] of summary.failures) {
        console.log(`  ${detail}: ${count}`);
      }
    }

    const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
    const passed = summaries.reduce((sum, summary) => sum + summary.passed, 0);
    console.log("\nSummary");
    console.log("=======");
    for (const summary of summaries) {
      console.log(
        `${summary.requested.toString().padStart(3)} concurrent: ${summary.passed}/${summary.total} successful`,
      );
    }
    console.log(`Total: ${passed}/${total} successful.`);
    if (controller.signal.aborted) {
      console.log("Test interrupted.");
      process.exitCode = 130;
    } else if (passed !== total) {
      process.exitCode = 1;
    }
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Request failed.");
  process.exitCode = 1;
}
