# API & MCP Server Submission Checklist

This document serves as a guide for manually submitting the TensorFlow.js Social Media MCP Server to various registries, marketplaces, and ecosystems.

## 1. Dedicated MCP (Model Context Protocol) Registries

| Directory / Registry | Type | Submission Method |
| :--- | :--- | :--- |
| **Smithery.ai** | Primary MCP Registry | `npx @smithery/cli publish` |
| **Glama.ai** | AI & MCP Index | Web Form / GitHub repo link |
| **PulseMCP** | Curated MCP Directory | Web form submit |
| **mcp.directory** | MCP Server Index | GitHub submission / Web |
| **mcp.so** | MCP Search & Discovery | Web submit |
| **Awesome-MCP-Servers** | #1 GitHub MCP List | GitHub Pull Request |
| **GitHub Topic #mcp-server** | Native GitHub Search | Add topic `mcp-server` to your repo |

## 2. Public API Catalogs & Marketplaces

| Platform | Details | Submission Method |
| :--- | :--- | :--- |
| **APIs.io** | Leading open API search index | Submit `apis.json` or URL |
| **APIs.guru** | The "Wikipedia of REST APIs" | GitHub Pull Request |
| **Public-APIs List** | Largest API repo on GitHub | Open an Issue / PR |
| **RapidAPI Hub** | Global API marketplace | RapidAPI Provider Studio |
| **Postman API Network** | Public Postman Workspace | Postman API / Web |
| **SwaggerHub** | SmartBear API directory | SwaggerHub Registry API |
| **Any-API** | Documentation & test playground | GitHub / Form |

## 3. LLM Agent & Workflow Tool Marketplaces

| Platform | How to list |
| :--- | :--- |
| **OpenAI Custom GPTs** | Add Action → Paste `openapi.json` |
| **Dify.ai Tool Market** | Submit as Custom Tool plugin via OpenAPI schema |
| **Coze.com** | Create Plugin → Import OpenAPI JSON |
| **LlamaHub** | Submit tool to LlamaHub GitHub repo |
| **LangChain Community** | Submit integration PR to `langchain-community` |
| **Flowise / Langflow** | Custom Tool import block |

## 4. Package & Container Registries

| Registry | Command | Keywords to include |
| :--- | :--- | :--- |
| **npm Registry** | `npm publish` | `mcp`, `mcp-server`, `modelcontextprotocol` |
| **Docker Hub** | `docker push` | N/A |
| **GHCR** | `docker push` | N/A |
