#!/usr/bin/env node
// Generates a Solana keypair and prints the address and base58-encoded private key
// for use with the x402 payment setup (.env: PAY_TO_ADDRESS + SOLANA_PRIVATE_KEY).

const { ed25519 } = require("@noble/curves/ed25519");
const { base58 } = require("@scure/base");

const secretKey32 = ed25519.utils.randomSecretKey();
const publicKey32 = ed25519.getPublicKey(secretKey32);

// Solana base58 private key = [secretKey(32) || publicKey(32)]
const fullPrivateKey = new Uint8Array(64);
fullPrivateKey.set(secretKey32, 0);
fullPrivateKey.set(publicKey32, 32);

const address = base58.encode(publicKey32);
const privateKeyB58 = base58.encode(fullPrivateKey);

console.log("=== Solana keypair generated ===\n");
console.log("PAY_TO_ADDRESS (public address):");
console.log("  " + address + "\n");
console.log("SOLANA_PRIVATE_KEY (base58 secret key):");
console.log("  " + privateKeyB58 + "\n");
console.log("Add these two lines to your .env file.\n");
console.log("For test (devnet) USDC, use a Solana devnet faucet. See:");
console.log("  https://faucet.solana.com  (SOL)");
