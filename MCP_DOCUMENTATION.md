# TensorFlow Social Media MCP Server

This MCP (Model Context Protocol) server provides a comprehensive suite of machine learning-powered analytics tools for various social media platforms, including YouTube, Instagram, TikTok, Twitter, Facebook, Discord, Twitch, Reddit, LinkedIn, Threads, Bluesky, Mastodon, GitHub, Spotify, and Pinterest.

## Features

- **Platform-Specific ML Analytics:** Hundreds of tools for sentiment analysis, toxicity detection, engagement prediction, trend detection, content classification, and clustering across multiple social platforms.
- **Core ML Functionality:** Includes general-purpose tools for image analysis, text processing (keywords, sentiment, embeddings), and ML forecasting.
- **x402 Payment Integration:** Features a built-in payment gateway using x402 (Solana devnet USDC) for paid access to ML tools.

## Setup and Running

The server requires Node.js (>=18).

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Configuration:**
    Ensure a `.env` file is present (see `.env.example`).

3.  **Start the Server:**
    The server provides multiple transport mechanisms:

    ```bash
    npm run mcp
    ```

    This runs the server using the MCP SDK.

## API & Transports

The server exposes both SSE and HTTP transports for MCP clients:

- **SSE Transport:** `http://localhost:<PORT>/mcp`
- **Streamable HTTP Transport:** `http://localhost:<PORT>/http`

Additionally, a REST API is available for direct tool access:

- **POST /api/v1/tools/:toolName:** Enqueue a tool job.
- **POST /api/v1/tools/:toolName/sync:** Execute a tool synchronously.
- **GET /api/v1/jobs/:jobId:** Check job status.
- **GET /api/v1/tools:** List all available tools.

## Payment (x402)

When `x402` gate is enabled, tool usage requires payment.

- Unauthenticated requests receive an HTTP 402 challenge.
- The `x-payment-info` header in the OpenAPI spec provides payment protocol details.
- Tools are paid via the facilitator client.

## Tools Summary

The server exposes over 160 tools categorized by platform/function:

- **Core:** Image classification/detection, Text analysis/embedding, ML forecasting/clustering.
- **Social Media:** Specific tools for:
  - **YouTube:** Thumbnails, content classification, view prediction, growth forecasting.
  - **Instagram:** Engagement prediction, visual trends, growth/anomaly detection.
  - **TikTok:** Virality prediction, trend/pattern detection.
  - **Twitter/X:** Sentiment/toxicity analysis, engagement prediction.
  - **...and more for Facebook, Discord, Twitch, Reddit, LinkedIn, Threads, Bluesky, Mastodon, GitHub, Spotify, Pinterest.**

For a complete list of tools, check `lib/tool-registry.js` or query the `/api/v1/tools` endpoint.
