const { base58 } = require("@scure/base");
const { createSolanaRpc, address } = require("@solana/kit");
const { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } = require("@solana-program/token");
const { USDC_DEVNET_ADDRESS } = require("@x402/svm");

const RPC = "https://api.devnet.solana.com";
const rpc = createSolanaRpc(RPC);
const payer = "BGrVHapUpeox7XG6EaA8g2tkDZr7fuPzCawzAwzyqHef";

async function main() {
  const owner = address(payer);
  const mint = address(USDC_DEVNET_ADDRESS);
  const [ata] = await findAssociatedTokenPda({ mint, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const sol = await rpc.getBalance(owner).send().catch(() => null);
  let usdc = null;
  const acct = await rpc.getAccountInfo(ata, { encoding: "jsonParsed" }).send().catch(() => null);
  if (acct?.value?.data?.parsed?.info?.tokenAmount) {
    usdc = acct.value.data.parsed.info.tokenAmount.uiAmountString;
  }
  const solLamports = Number(sol?.value ?? 0n);
  console.log(JSON.stringify({ sol: (solLamports / 1e9).toFixed(6), solLamports, usdc: usdc ? String(usdc) : "none (ATA missing)", ata: ata.toString() }));
}
main().catch(e => { console.log("ERR", e.message); process.exit(1); });
