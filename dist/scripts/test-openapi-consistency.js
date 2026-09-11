const fs = require('fs');
const path = require('path');

// Load files
const openApi = JSON.parse(fs.readFileSync(path.join(__dirname, '../openapi.json'), 'utf8'));
const toolRegistry = require('../lib/tool-registry');

const openApiPaths = Object.keys(openApi.paths);
const registeredTools = Object.keys(toolRegistry);

let missingInRegistry = [];
let extraInRegistry = [];

// Check paths in OpenAPI exist in registry
openApiPaths.forEach(path => {
    // OpenAPI paths are like /tools/tool-name
    const toolName = path.replace('/tools/', '');
    if (!registeredTools.includes(toolName)) {
        missingInRegistry.push(toolName);
    }
});

// Check registry tools exist in OpenAPI
registeredTools.forEach(tool => {
    const path = `/tools/${tool}`;
    if (!openApiPaths.includes(path)) {
        extraInRegistry.push(tool);
    }
});

console.log('--- API Consistency Check ---');
if (missingInRegistry.length === 0 && extraInRegistry.length === 0) {
    console.log('✅ OpenAPI spec and tool registry are in sync.');
} else {
    if (missingInRegistry.length > 0) {
        console.log('❌ Tools defined in OpenAPI but missing in registry:', missingInRegistry);
    }
    if (extraInRegistry.length > 0) {
        console.log('❌ Tools in registry but missing in OpenAPI:', extraInRegistry);
    }
}
