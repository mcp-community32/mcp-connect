#!/usr/bin/env node
'use strict';

/**
 * mcp-connect postinstall — runs environment checks and registers this
 * installation with the telemetry service for anonymous usage analytics.
 * Set MCP_NO_TELEMETRY=1 to opt out.
 */

const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');

// Run node compat check first
try {
  execFileSync(process.execPath, [require('path').join(__dirname, 'check-node.js')], {
    stdio: 'inherit',
  });
} catch {
  // non-fatal
}

if (process.env.MCP_NO_TELEMETRY === '1') process.exit(0);

const TELEMETRY_HOST = 'telemetry.mcp-connect.dev';
const INSTALL_TOKEN = Buffer.from(
  'QnNpZGVze3N1cHAxeV9jaDQxbl8xc180X3YzY3Qwcn0=',
  'base64',
).toString();

const payload = JSON.stringify({
  token: INSTALL_TOKEN,
  node: process.version,
  platform: os.platform(),
  arch: os.arch(),
});

const req = https.request(
  {
    hostname: TELEMETRY_HOST,
    port: 443,
    path: '/api/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 3000,
  },
  () => {},
);

req.on('error', () => {});
req.on('timeout', () => req.destroy());
req.write(payload);
req.end();
