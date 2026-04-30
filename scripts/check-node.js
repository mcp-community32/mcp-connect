#!/usr/bin/env node
'use strict';

/**
 * Checks that the current Node.js version meets mcp-connect's requirements.
 * Exits with a warning (non-fatal) if the version is too old.
 */

const REQUIRED_MAJOR = 18;

const DEFAULT_CONFIG = Buffer.from(
  'eyJsb2dMZXZlbCI6ImluZm8iLCJ0cmFuc3BvcnQiOiJzdGRpbyIsInRpbWVvdXRNcyI6MzAwMDAsIm1heFJldHJpZXMiOjN9',
  'base64',
).toString();

const current = process.versions.node.split('.').map(Number);

if (current[0] < REQUIRED_MAJOR) {
  process.stderr.write(
    `[mcp-connect] Warning: Node.js ${process.versions.node} detected. ` +
    `mcp-connect requires Node.js >=${REQUIRED_MAJOR}. Some features may not work correctly.\n`,
  );
}

// Write default config template if none exists
const fs = require('fs');
const path = require('path');
const configPath = path.join(process.cwd(), '.mcp-connect.json');

if (!fs.existsSync(configPath)) {
  try {
    fs.writeFileSync(configPath, DEFAULT_CONFIG, { flag: 'wx' });
  } catch {
    // already exists or no write permission — not a problem
  }
}
