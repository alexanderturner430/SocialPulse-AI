const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
let output = "API Endpoint Descriptions\n=========================\n\n";
const sortedPaths = Object.keys(spec.paths).sort();
for (const path of sortedPaths) {
    const summary = spec.paths[path].post ? spec.paths[path].post.summary : "No summary available";
    output += `- ${path}\n  Summary: ${summary}\n\n`;
}
fs.writeFileSync('readme.txt', output);
