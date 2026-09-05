# TensorFlow.js Social Media MCP Server

[![MCP Server](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io/)

A comprehensive suite of machine learning tools for analyzing and automating interactions across multiple social media platforms, built on [TensorFlow.js](https://www.tensorflow.org/js) and powered by the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

This server performs ML-based analytics locally (e.g., sentiment analysis, toxicity detection, engagement prediction, content clustering) without relying on external cloud-based AI services, ensuring data privacy and low-latency processing.

## Key Features

- **Cross-Platform Support**: Tools for YouTube, Instagram, TikTok, Twitter, Facebook, Discord, Twitch, Reddit, LinkedIn, Threads, Bluesky, Mastodon, GitHub, Spotify, and Pinterest.
- **Local Machine Learning**: Powered by TensorFlow.js (MobileNet, COCO-SSD, Universal Sentence Encoder, etc.).
- **Monetization Ready**: Integrated [x402 protocol](https://x402.org/) for charging per tool call via Solana (devnet/mainnet).
- **Extensible**: Easily add new tools via `lib/` modules and `tool-registry.js`.
- **Ready for Agents**: Full OpenAPI 3.0 specification for seamless integration with AI agents.

## Setup Requirements

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Configuration

Copy `.env.example` to `.env` and configure the following:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PAY_TO_ADDRESS` | Solana wallet address to receive x402 payments. | **REQUIRED** |
| `FACILITATOR_URL` | x402 facilitator URL. | `https://x402.org/facilitator` |
| `X402_PRICE_USD` | Price per tool call in USD. | `0.005` |
| `X402_NETWORK` | Payment network (`devnet` or `mainnet`). | `devnet` |
| `PUBLIC_ORIGIN` | Public URL for the server (needed for discovery). | `http://localhost:6350` |

## Installation

```bash
npm install
```

## Running the Server

### Start the MCP Server
```bash
npm run mcp
```

### Start all services (MCP, REST, Worker)
```bash
npm run start:all
```

### Start the TUI
```bash
npm run tui
```

## API Documentation

The server exposes an OpenAPI 3.0 specification at `http://localhost:6350/openapi.json`.

See `readme.txt` in the root for a summary of available endpoints.

## Contributing

1. Fork the repository.
2. Create your feature branch.
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

#


# License

MIT
