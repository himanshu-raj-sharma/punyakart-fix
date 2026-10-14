// Hostinger Node.js entry point.
// Hostinger loads this file with CommonJS require(), so keep this file
// CommonJS-compatible and dynamically import the compiled server.
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const compiledServer = pathToFileURL(path.join(__dirname, 'dist', 'server.cjs')).href;

import(compiledServer).catch((err) => {
  console.error('Failed to start Punyakart server:', err);
  process.exitCode = 1;
});
