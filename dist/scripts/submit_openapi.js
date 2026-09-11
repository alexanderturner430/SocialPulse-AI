/**
 * Automated OpenAPI & MCP Directory Submitter
 * Node.js (v18+)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const SPEC_FILE = path.join(__dirname, '..', 'openapi.json');

// 1. Load and Validate Local openapi.json
function loadSpec() {
  if (!fs.existsSync(SPEC_FILE)) {
    throw new Error(`File '${SPEC_FILE}' not found. Ensure openapi.json is in the root directory.`);
  }
  const rawData = fs.readFileSync(SPEC_FILE, 'utf-8');
  return JSON.parse(rawData);
}

// 2. Submit to SwaggerHub Free Registry
async function submitToSwaggerHub(spec) {
  const apiKey = process.env.SWAGGERHUB_API_KEY;
  const owner = process.env.SWAGGERHUB_OWNER;

  if (!apiKey || !owner) {
    console.log('[SKIPPED] SwaggerHub: Missing SWAGGERHUB_API_KEY or SWAGGERHUB_OWNER in .env');
    return;
  }

  const rawTitle = spec.info?.title || 'social-media-mcp-server';
  const title = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const version = spec.info?.version || '1.0.0';

  const url = `https://api.swaggerhub.com/apis/${owner}/${title}?version=${version}&isPrivate=false`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spec)
    });

    if (res.ok || res.status === 201) {
      console.log(`[SUCCESS] SwaggerHub: Published to https://app.swaggerhub.com/apis/${owner}/${title}/${version}`);
    } else {
      const errorText = await res.text();
      console.log(`[ERROR] SwaggerHub: ${res.status} - ${errorText}`);
    }
  } catch (err) {
    console.error(`[ERROR] SwaggerHub failed: ${err.message}`);
  }
}

// 3. Submit to Postman Public API Network / Workspace
async function submitToPostman(spec) {
  const apiKey = process.env.POSTMAN_API_KEY;
  const workspaceId = process.env.POSTMAN_WORKSPACE_ID;

  if (!apiKey) {
    console.log('[SKIPPED] Postman: Missing POSTMAN_API_KEY in .env');
    return;
  }

  let url = 'https://api.getpostman.com/apis';
  if (workspaceId) {
    url += `?workspace=${workspaceId}`;
  }

  const headers = {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json'
  };

  const payload = {
    api: {
      name: spec.info?.title || 'MCP Server API',
      summary: 'Social Media TensorFlow.js MCP Server Tools',
      description: 'Auto-imported from OpenAPI specification.'
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (res.ok || res.status === 201) {
      const data = await res.json();
      const apiId = data.api?.id;
      console.log(`[SUCCESS] Postman: Created API entity (ID: ${apiId})`);

      const schemaUrl = `https://api.getpostman.com/apis/${apiId}/versions/1.0.0/schemas`;
      const schemaPayload = {
        schema: {
          language: 'json',
          type: 'openapi3',
          schema: JSON.stringify(spec)
        }
      };

      const schemaRes = await fetch(schemaUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(schemaPayload)
      });

      if (schemaRes.ok || schemaRes.status === 201) {
        console.log('[SUCCESS] Postman: Attached OpenAPI 3.0 schema.');
      }
    } else {
      const errorText = await res.text();
      console.log(`[ERROR] Postman: ${res.status} - ${errorText}`);
    }
  } catch (err) {
    console.error(`[ERROR] Postman failed: ${err.message}`);
  }
}

// 4. Submit to RapidAPI Hub
async function submitToRapidAPI(spec) {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    console.log('[SKIPPED] RapidAPI: Missing RAPIDAPI_KEY in .env');
    return;
  }

  const url = 'https://rapidapi.com/provider/api/import/openapi';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spec)
    });

    if (res.ok || res.status === 201) {
      console.log('[SUCCESS] RapidAPI: Imported API definition.');
    } else {
      const errorText = await res.text();
      console.log(`[ERROR] RapidAPI: ${res.status} - ${errorText}`);
    }
  } catch (err) {
    console.error(`[ERROR] RapidAPI failed: ${err.message}`);
  }
}

// 5. Submit to Smithery MCP Registry (CLI)
function publishToSmithery() {
  console.log('[INFO] Attempting MCP Registry submission via Smithery CLI...');
  try {
    const output = execSync('npx -y @smithery/cli@latest publish', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('[SUCCESS] Smithery Registry: Published successfully.');
  } catch (err) {
    console.log(`[INFO] Smithery CLI Note: Requires a git repo with smithery.yaml context.\nOutput: ${err.stdout || err.stderr || err.message}`);
  }
}

// Helper: Generate bundle directory
function prepareGitHubSubmission(spec, platformName, outputSubDir) {
  const outputDir = path.join(__dirname, 'submissions', outputSubDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filePath = path.join(outputDir, 'openapi.json');
  fs.writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`[INFO] ${platformName} Submission Package Ready:`);
  console.log(`  - Files created at: ${outputDir}`);
}

// Main Execution
async function main() {
  console.log('==================================================');
  console.log('   OpenAPI & MCP Directory Automated Submitter    ');
  console.log('==================================================\n');

  let spec;
  try {
    spec = loadSpec();
  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
  }

  console.log('--- 1. AUTOMATED SUBMISSIONS ---');
  await submitToSwaggerHub(spec);
  await submitToPostman(spec);
  await submitToRapidAPI(spec);
  publishToSmithery();
  console.log();

  console.log('--- 2. PREPARING GITHUB PR SUBMISSIONS ---');
  prepareGitHubSubmission(spec, 'APIs.guru', 'apis_guru');
  prepareGitHubSubmission(spec, 'LlamaHub', 'llama_hub');
  prepareGitHubSubmission(spec, 'LangChain Community', 'langchain_community');
  console.log('  -> Action Required: Fork respective repositories, place openapi.json under required structure, and submit PR.\n');

  console.log('--- 3. MANUAL WEB FORM SUBMISSIONS (Action Required) ---');
  console.log('  • Glama.ai (MCP Registry): https://glama.ai/mcp');
  console.log('  • PulseMCP (Curated Index): https://www.pulsemcp.com/submit');
  console.log('  • mcp.so (Search & Discovery): https://mcp.so');
  console.log('  • OpenAI Custom GPTs: Create GPT -> Configure -> Actions -> Paste openapi.json');
  console.log('  • Dify.ai / Coze.com: Create Plugin -> Import via OpenAPI JSON');
  console.log('  • Any-API: Follow instructions at any-api.com');
  console.log('==================================================');
}

main();
