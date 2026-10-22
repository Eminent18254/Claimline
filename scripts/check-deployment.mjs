import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/config/deployment.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'contracts/Claimline.py'));
assert.equal(manifest.chainId, 61999);
assert.match(manifest.address, /^0x[0-9a-fA-F]{40}$/);
assert.equal(createHash('sha256').update(source).digest('hex'), manifest.sourceSha256,
  'Contract source differs from the verified deployment. Run npm run deploy:contract before building.');
console.log('Verified deployment manifest matches the contract source:', manifest.address);
