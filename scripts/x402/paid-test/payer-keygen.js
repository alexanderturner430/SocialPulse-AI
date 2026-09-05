#!/usr/bin/env node
// GENERATE A FRESH SOLANA KEYPAIR (devnet test payer)
// Uses @scure/base + @noble/curves/ed25519 (combined package @scure/bip39 is available but
// we generate a random 32-byte seed directly with ed25519.utils.randomSecretKey / crypto).
//
// Outputs:
//   - public key (PAYER_ADDRESS, base58)
//   - 64-byte base58 "secret key" ([seed(32) || pubkey(32)]) suitable for @solana/kit
//     createKeyPairSignerFromBytes(...)
//
// Writes the keypair to /tmp/opencode/payer.json so the paid-request harness can reuse it.

const fs = require("node:fs");
const path = require("node:path");
const { ed25519 } = require("@noble/curves/ed25519");
const { base58 } = require("@scure/base");

function main() {
  const seed = ed25519.utils.randomSecretKey(); // 32 bytes
  const pub = ed25519.getPublicKey(seed);        // 32 bytes

  const secretKey64 = new Uint8Array(64);
  secretKey64.set(seed, 0);
  secretKey64.set(pub, 32);

  const payerAddress = base58.encode(pub);
  const secretKeyB58  = base58.encode(secretKey64);
  const seedB58       = base58.encode(seed);

  const out = {
    payerAddress,
    secretKeyB58,
    seedB58,
    seedHex: Buffer.from(seed).toString("hex"),
  };
  fs.writeFileSync(path.join(__dirname, "payer.json"), JSON.stringify(out, null, 2));

  console.log("=== Fresh Solana keypair (devnet test payer) ===");
  console.log("PAYER_ADDRESS ::", payerAddress);
  console.log("SECRET_KEY    ::", secretKeyB58);
  console.log("SEED_HEX      ::", out.seedHex);
  console.log("Wrote payer.json to", path.join(__dirname, "payer.json"));
}

main();
