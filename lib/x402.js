const { paymentMiddleware, x402ResourceServer } = require("@x402/express");
const { HTTPFacilitatorClient } = require("@x402/core/server");
const { ExactSvmScheme } = require("@x402/svm/exact/server");
const { declareDiscoveryExtension } = require("@x402/extensions/bazaar");
const {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  USDC_DEVNET_ADDRESS,
  USDC_MAINNET_ADDRESS,
  DEVNET_RPC_URL,
  MAINNET_RPC_URL,
} = require("@x402/svm");

const USDC_DECIMALS = 6;
const DEFAULT_PRICE_USD = 0.005;

const NETWORKS = {
  devnet: {
    caip2: SOLANA_DEVNET_CAIP2,
    asset: USDC_DEVNET_ADDRESS,
    rpcUrl: DEVNET_RPC_URL,
  },
  mainnet: {
    caip2: SOLANA_MAINNET_CAIP2,
    asset: USDC_MAINNET_ADDRESS,
    rpcUrl: MAINNET_RPC_URL,
  },
};

function loadNetwork() {
  const name = String(process.env.X402_NETWORK || "devnet").toLowerCase();
  const net = NETWORKS[name];
  if (!net) {
    throw new Error(`X402_NETWORK must be one of: ${Object.keys(NETWORKS).join(", ")} (got "${name}")`);
  }
  return { name, ...net };
}

function loadConfig() {
  const payTo = process.env.PAY_TO_ADDRESS;
  const facilitatorUrl = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
  if (!payTo) {
    throw new Error("PAY_TO_ADDRESS environment variable is required for x402 payments");
  }

  const configuredPrice = process.env.X402_PRICE_USD;
  const priceUsd = configuredPrice === undefined ? DEFAULT_PRICE_USD : Number(configuredPrice);
  if (!(Number.isFinite(priceUsd) && priceUsd > 0)) {
    throw new Error("X402_PRICE_USD must be a positive number");
  }
  const priceAtomic = String(Math.round(priceUsd * 10 ** USDC_DECIMALS));
  const network = loadNetwork();
  return { payTo, facilitatorUrl, priceUsd, priceAtomic, network };
}

function buildFacilitatorClient(config) {
  return new HTTPFacilitatorClient({ url: config.facilitatorUrl });
}

function buildResourceServer(facilitatorClient, config) {
  return new x402ResourceServer(facilitatorClient).register(
    config.network.caip2,
    new ExactSvmScheme()
  );
}

function bazaarExtensionForTool(tool) {
  try {
    const inputSchema = tool.inputSchema && tool.inputSchema.properties
      ? tool.inputSchema.properties
      : { input: { type: "object" } };
    const ext = declareDiscoveryExtension({
      method: "POST",
      bodyType: "json",
      input: tool.inputSchema || { type: "object" },
      inputSchema,
    });
    return ext.bazaar || {};
  } catch (err) {
    return {};
  }
}

function buildRouteConfig(config, toolDefinitions) {
  const routes = {};
  for (const tool of toolDefinitions) {
    const bazaar = bazaarExtensionForTool(tool);
    routes[`POST /api/v1/tools/${tool.name}`] = {
      accepts: {
        scheme: "exact",
        price: `$${config.priceUsd}`,
        network: config.network.caip2,
        payTo: config.payTo,
        maxTimeoutSeconds: 60,
      },
      description: `ML tool: ${tool.description}`,
      mimeType: "application/json",
      extensions: { bazaar },
    };
    routes[`POST /api/v1/tools/${tool.name}/sync`] = {
      accepts: {
        scheme: "exact",
        price: `$${config.priceUsd}`,
        network: config.network.caip2,
        payTo: config.payTo,
        maxTimeoutSeconds: 60,
      },
      description: `ML tool (sync): ${tool.description}`,
      mimeType: "application/json",
      extensions: { bazaar },
    };
  }
  return routes;
}

function buildPaymentRequired(toolName, toolDescription, config) {
  return {
    x402Version: 2,
    error: `Payment required for tool: ${toolName}`,
    resource: {
      url: `mcp://tool/${toolName}`,
      description: toolDescription,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: config.network.caip2,
        amount: config.priceAtomic,
        asset: config.network.asset,
        payTo: config.payTo,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USDC",
          version: "2",
        },
      },
    ],
  };
}

function mcpPaymentRequiredResult(paymentRequired) {
  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(paymentRequired),
      },
    ],
    _meta: {
      "x402/payment-required": encoded,
    },
  };
}

function mcpPaymentResponseResult(result, settleResponse) {
  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
      },
    ],
    _meta: {
      "x402/payment-response": settleResponse,
    },
  };
}

let _x402Config = null;
let _gateEnabled = true;

function gateAwareMiddleware(original) {
  return (req, res, next) => {
    if (!_gateEnabled) return next();
    return original(req, res, next);
  };
}

function init(toolDefinitions) {
  const config = loadConfig();
  const facilitatorClient = buildFacilitatorClient(config);
  const resourceServer = buildResourceServer(facilitatorClient, config);
  const routes = buildRouteConfig(config, toolDefinitions);
  const state = {
    config,
    facilitatorClient,
    resourceServer,
    toolDefinitions,
    routes,
    paymentMiddleware: paymentMiddleware(routes, resourceServer),
  };
  state.middleware = (req, res, next) => {
    if (!_gateEnabled) return next();
    return state.paymentMiddleware(req, res, next);
  };

  _gateEnabled = true;
  _x402Config = state;
  return _x402Config;
}

function getConfig() {
  if (!_x402Config) throw new Error("x402 not initialized. Call init() first.");
  return _x402Config;
}

function getStatus() {
  const { config, facilitatorClient, resourceServer } = getConfig();
  return {
    payTo: config.payTo,
    facilitatorUrl: config.facilitatorUrl,
    priceUsd: config.priceUsd,
    priceAtomic: config.priceAtomic,
    network: config.network.caip2,
    asset: config.network.asset,
    netName: config.network.name,
    gateEnabled: _gateEnabled,
    scheme: "exact",
    facilitatorCount: facilitatorClient ? 1 : 0,
    resourceServerRegistered: !!resourceServer,
  };
}

function setGateEnabled(enabled) {
  _gateEnabled = !!enabled;
  return getStatus();
}

function setPrice(priceUsd) {
  if (!(Number.isFinite(priceUsd) && priceUsd > 0)) {
    throw new Error("priceUsd must be a positive number");
  }
  const { config } = getConfig();
  config.priceUsd = priceUsd;
  config.priceAtomic = String(Math.round(priceUsd * 10 ** USDC_DECIMALS));
  _x402Config.routes = buildRouteConfig(config, _x402Config.toolDefinitions);
  _x402Config.paymentMiddleware = paymentMiddleware(
    _x402Config.routes,
    _x402Config.resourceServer
  );
  return getStatus();
}

function isGateEnabled() {
  return _gateEnabled;
}

module.exports = {
  USDC_DECIMALS,
  NETWORKS,
  init,
  getConfig,
  getStatus,
  setGateEnabled,
  setPrice,
  isGateEnabled,
  buildPaymentRequired,
  mcpPaymentRequiredResult,
  mcpPaymentResponseResult,
};
