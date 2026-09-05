#!/usr/bin/env node
// ============================================================================
// CLIENT-SIDE x402 PAID TEST HARNESS  (devnet, zero real money)
//
// Full flow:  fetch 402 challenge -> build signed payment payload
//             -> server verifies via facilitator -> tool runs -> settles
//
// Protocol (x402 v2 / exact SVM):
//   * GET 402 challenge: `PAYMENT-REQUIRED` base64 header on HTTP 402.
//   * Payment payload (v2): { x402Version, payload:{transaction}, resource,
//                            accepted:{...}, extensions? }
//   * HTTP header for v2: `PAYMENT-SIGNATURE: base64(JSON.stringify(payload))`
//     (see @x402/core/src/http/x402HTTPClient.ts encodePaymentSignatureHeader)
//   * @x402/express middleware reads `payment-signature` || `x-payment`
//     (see @x402/express/dist/cjs/index.js paymentMiddlewareFromHTTPServer,
//      ExpressAdapter + `paymentHeader` var)
//
// USAGE:
//   node paid-request.js <endpoint> [payer.json]
//
// Examples:
//   node paid-request.js http://127.0.0.1:6360/api/v1/tools/analyze-text/sync
//
// The payer wallet (payer.json) must already hold devnet SOL + devnet USDC.
// ============================================================================

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { base58 } = require("@scure/base");
const { ed25519 } = require("@noble/curves/ed25519");
const { createKeyPairSignerFromBytes, createSolanaRpc, devnet } = require("@solana/kit");

const { ExactSvmScheme, toClientSvmSigner, createRpcClient, SOLANA_DEVNET_CAIP2, USDC_DEVNET_ADDRESS } = require("@x402/svm");
const { x402Client, x402HTTPClient } = require("@x402/core/client");

const SAFE_BASE64_SHA_256 = "sha256-safe"; // placeholder for clarity

function encodePaymentSignatureHeader(paymentPayload) {
  // Equivalent of @x402/core http.encodePaymentSignatureHeader (v2 => PAYMENT-SIGNATURE)
  return "PAYMENT-SIGNATURE: " + Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
}

function base64Header(paymentPayload) {
  return Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
}

async function main() {
  const endpoint = process.argv[2] ||
    "http://127.0.0.1:6360/api/v1/tools/analyze-text/sync";
  const payerFile = process.argv[3] || path.join(__dirname, "payer.json");

  // ---- 1. Load the freshly generated payer keypair -------------------------
  let payer;
  try {
    payer = JSON.parse(fs.readFileSync(payerFile, "utf8"));
  } catch (e) {
    console.error("Missing payer.json. Run payer-keygen.js first.");
    process.exit(1);
  }
  const secretKey64 = base58.decode(payer.secretKeyB58);
  const payerAddress = base58.encode(secretKey64.slice(32)); // pubkey half
  console.log("=== Payer wallet ===");
  console.log("  address:", payerAddress);

  // Signer used by both the client scheme (ExactSvmScheme) to sign the transfer
  // and by the facilitator-like local signer for fee payment (with a real
  // facilitator, the feePayer is the facilitator's wallet so this is only the
  // authority/owner signer for the USDC transfer).
  const signer = await createKeyPairSignerFromBytes(secretKey64);
  const clientSigner = toClientSvmSigner(signer);

  // ---- 2. Create the x402 client and register the exact SVM scheme --------
  const client = new x402Client();
  client.register(SOLANA_DEVNET_CAIP2, new ExactSvmScheme(clientSigner));
  const httpClient = new x402HTTPClient(client);

  // ---- 3. STEP 1: Fetch the 402 challenge ----------------------------------
  console.log("\n=== STEP 1: Fetch 402 challenge ===");
  console.log("  POST", endpoint, '{"text":"hello world"}');
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "hello world" }),
  });
  const payReqHeader = resp.headers.get("PAYMENT-REQUIRED");
  console.log("  HTTP status:", resp.status);
  if (resp.status !== 402 || !payReqHeader) {
    console.error("  Expected 402 + PAYMENT-REQUIRED header. Got status", resp.status);
    // body might be error JSON
    console.error("  body:", await resp.text());
    process.exit(1);
  }
  const paymentRequired = JSON.parse(Buffer.from(payReqHeader, "base64").toString("utf8"));
  console.log("  402 challenge decoded:");
  console.log("  ", JSON.stringify(paymentRequired, null, 2).split("\n").map(l => "    " + l).join("\n"));

  const accepted = paymentRequired.accepts[0];
  console.log("  Selected accept:", JSON.stringify({
    scheme: accepted.scheme,
    network: accepted.network,
    amount: accepted.amount,
    asset: accepted.asset,
    payTo: accepted.payTo,
    feePayer: accepted.extra?.feePayer,
  }, null, 2));

  // ---- 4. STEP 2: Build the signed payment payload -------------------------
  console.log("\n=== STEP 2: Build signed payment payload ===");
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  console.log("  paymentPayload.x402Version:", paymentPayload.x402Version);
  console.log("  payload.transaction (base64 head):",
    paymentPayload.payload.transaction.slice(0, 40) + "...");
  console.log("  accepted.amount:", paymentPayload.accepted?.amount);
  console.log("  accepted.asset:", paymentPayload.accepted?.asset);
  console.log("  accepted.payTo:", paymentPayload.accepted?.payTo);

  // ---- 5. STEP 3: Send the payment against the server ----------------------
  console.log("\n=== STEP 3: Send signed payment (PAYMENT-SIGNATURE header) ===");
  const headerValue = base64Header(paymentPayload);
  const paidResp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "payment-signature": headerValue, // case-insensitive; @x402/express reads it
    },
    body: JSON.stringify({ text: "hello world" }),
  });

  console.log("  HTTP status:", paidResp.status);
  const payRespHeader = paidResp.headers.get("PAYMENT-RESPONSE");
  const bodyText = await paidResp.text();
  console.log("  PAYMENT-RESPONSE header:", payRespHeader);
  console.log("  response body:", bodyText.slice(0, 800));

  let settleResponse = null;
  if (payRespHeader) {
    try {
      settleResponse = JSON.parse(Buffer.from(payRespHeader, "base64").toString("utf8"));
    } catch (e) {
      settleResponse = { raw: payRespHeader };
    }
  }
  console.log("\n=== Result ===");
  console.log("  verify+tool+settle passed:", paidResp.status === 200 && settleResponse?.success !== false);
  console.log("  settleResponse:", JSON.stringify(settleResponse, null, 2));
  console.log("  tool output:", bodyText.slice(0, 600));
}

main().catch((e) => {
  console.error("\n=== HARNESS ERROR ===");
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
