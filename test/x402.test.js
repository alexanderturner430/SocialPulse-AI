const x402 = require("../lib/x402");

const PAY_TO = "AXnDY79R7rWXaLT8t8TLhNSCmhDEDvrnJFAP88SBKy4z";
const TOOL = { name: "analyze-text", description: "Analyze text", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } };
const ORIGINAL_PAY_TO = process.env.PAY_TO_ADDRESS;

beforeEach(() => {
  process.env.PAY_TO_ADDRESS = PAY_TO;
});

afterAll(() => {
  if (ORIGINAL_PAY_TO === undefined) delete process.env.PAY_TO_ADDRESS;
  else process.env.PAY_TO_ADDRESS = ORIGINAL_PAY_TO;
});

function freshInit() {
  // x402 caches config in a module-level variable; re-init each test.
  return x402.init([TOOL]);
}

describe("x402 network selection", () => {
  const ORIG = process.env.X402_NETWORK;

  afterEach(() => {
    if (ORIG === undefined) delete process.env.X402_NETWORK;
    else process.env.X402_NETWORK = ORIG;
  });

  it("defaults to devnet when X402_NETWORK is unset", () => {
    delete process.env.X402_NETWORK;
    const s = freshInit().config.network;
    expect(s.name).toBe("devnet");
    expect(s.caip2).toBe("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    expect(s.asset).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  });

  it("selects mainnet when X402_NETWORK=mainnet", () => {
    process.env.X402_NETWORK = "mainnet";
    const s = freshInit().config.network;
    expect(s.name).toBe("mainnet");
    expect(s.caip2).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    expect(s.asset).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });

  it("throws on an unknown X402_NETWORK value", () => {
    process.env.X402_NETWORK = "nope";
    expect(() => x402.init([TOOL])).toThrow(/X402_NETWORK/);
  });
});

describe("x402 payment requirements", () => {
  let config;

  beforeEach(() => {
    process.env.X402_NETWORK = "mainnet";
    config = freshInit().config;
  });

  it("builds a payment-required challenge for the configured network and recipient", () => {
    const req = x402.buildPaymentRequired("analyze-text", "Analyze text", config);
    expect(req.x402Version).toBe(2);
    expect(req.resource.url).toBe("mcp://tool/analyze-text");
    expect(req.accepts).toHaveLength(1);
    const a = req.accepts[0];
    expect(a.scheme).toBe("exact");
    expect(a.network).toBe(config.network.caip2);
    expect(a.asset).toBe(config.network.asset);
    expect(a.payTo).toBe(process.env.PAY_TO_ADDRESS || PAY_TO);
    expect(a.amount).toBe(config.priceAtomic);
  });

  it("encodes the challenge as a base64 x402/payment-required meta field", () => {
    const req = x402.buildPaymentRequired("analyze-text", "Analyze text", config);
    const res = x402.mcpPaymentRequiredResult(req);
    expect(res.isError).toBe(true);
    const encoded = res._meta["x402/payment-required"];
    expect(typeof encoded).toBe("string");
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].payTo).toBe(req.accepts[0].payTo);
  });
});

describe("x402 gate", () => {
  beforeEach(() => {
    delete process.env.X402_NETWORK;
    x402.init([TOOL]);
  });

  it("is enabled by default", () => {
    expect(x402.isGateEnabled()).toBe(true);
    expect(x402.getStatus().gateEnabled).toBe(true);
  });

  it("toggles the gate and reflects it in status", () => {
    x402.setGateEnabled(false);
    expect(x402.isGateEnabled()).toBe(false);
    expect(x402.getStatus().gateEnabled).toBe(false);
    x402.setGateEnabled(true);
    expect(x402.isGateEnabled()).toBe(true);
  });

  it("rejects an invalid price in setPrice", () => {
    expect(() => x402.setPrice(-1)).toThrow(/positive/);
    expect(() => x402.setPrice(NaN)).toThrow(/positive/);
  });

  it("updates priceAtomic when price changes", () => {
    x402.setPrice(1);
    expect(x402.getStatus().priceAtomic).toBe("1000000");
  });

  it("rebuilds payment routes when the price changes", () => {
    x402.setPrice(1);
    const route = x402.getConfig().routes["POST /api/v1/tools/analyze-text"];
    expect(route.accepts.price).toBe("$1");
  });
});
