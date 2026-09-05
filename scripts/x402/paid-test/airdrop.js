#!/usr/bin/env node
// AIRDROP devnet SOL to a fresh payer wallet.
// Tries, in order:
//   1. The public RPC `requestAirdrop` on https://api.devnet.solana.com
//   2. The Solana Foundation web faucet faucet.solana.com (if it exposes a POST API)
//   3. A generic POST via the devnet RPC used by third-party faucets
//
// Because faucet `.com` is a Next.js SPA and the public RPC rate-limits requestAirdrop
// to ~2 requests / 8h per IP, this script documents the actual result.

const { base58 } = require("@scure/base");

const RPC = "https://api.devnet.solana.com";
const AMOUNT_LAMPORTS = 1_000_000_000; // 1 devnet SOL

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

async function tryPublicRpcAirdrop(address) {
  console.log(`\n[1] requestAirdrop via ${RPC} for ${address}`);
  const json = await rpcCall(RPC, "requestAirdrop", [
    address,
    AMOUNT_LAMPORTS,
    { commitment: "finalized" },
  ]);
  console.log("    response:", JSON.stringify(json));
  if (json.result) return json.result;
  if (json.error?.code === 429) {
    console.log("    -> rate-limited (faucet dry / per-IP cap).");
  }
  return null;
}

async function tryFaucetDotCom(address) {
  console.log(`\n[2] faucet.solana.com/api/airdrop POST for ${address}`);
  try {
    const res = await fetch("https://faucet.solana.com/api/airdrop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, amount: 1 }),
    });
    const text = await res.text();
    console.log("    HTTP", res.status, "body(head):", text.slice(0, 160));
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch { /* not json */ }
    }
  } catch (e) {
    console.log("    network/parse error:", e.message);
  }
  return null;
}

async function main() {
  let address = process.argv[2];
  if (!address) {
    try {
      address = require("./payer.json").payerAddress;
    } catch {
      console.error("Provide a payer address as argv[2] or run payer-keygen.js first.");
      process.exit(1);
    }
  }

  // Validate base58 address (32 bytes -> length ~43-44)
  const bytes = base58.decode(address);
  if (bytes.length !== 32) {
    console.error("Not a valid 32-byte Solana pubkey address:", address);
    process.exit(1);
  }

  let signature;
  signature = await tryPublicRpcAirdrop(address);
  if (!signature) signature = await tryFaucetDotCom(address);

  // Verify balance after any successful airdrop
  if (signature) {
    console.log("\nAIRDROP SIGNATURE:", signature);
    // give it a moment
    await new Promise((r) => setTimeout(r, 3000));
    const bal = await rpcCall(RPC, "getBalance", [address]);
    console.log("Balance after airdrop:", JSON.stringify(bal));
  } else {
    console.log(
      "\nResult: could NOT obtain devnet SOL (faucet rate-limited / SPA).\n" +
      "Run this script where network + faucet are available, or use a pre-funded devnet wallet."
    );
    process.exit(2);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
