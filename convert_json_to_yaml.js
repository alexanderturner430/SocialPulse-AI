const fs = require('fs');
const yaml = require('js-yaml');

const spec = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
fs.writeFileSync('openapi.yaml', yaml.dump(spec, { indent: 2, lineWidth: -1 }));
console.log('Successfully converted openapi.json to openapi.yaml');
