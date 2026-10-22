import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function syncDeployment(proof) {
  assert.equal(proof.byteForByteMatch, true);
  assert.equal(proof.status, 'FINALIZED');
  assert.match(proof.address, /^0x[0-9a-fA-F]{40}$/);
  const oldManifest = path.join(root, 'frontend/src/config/deployment.json');
  const previous = fs.existsSync(oldManifest) ? JSON.parse(fs.readFileSync(oldManifest, 'utf8')) : null;
  const manifest = { chainId: proof.chainId, address: proof.address, transaction: proof.hash, sourceSha256: proof.sourceSha256 };
  fs.writeFileSync(path.join(root, 'frontend/src/config/deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (previous) {
    for (const name of ['README.md', 'submission.md']) {
      const file = path.join(root, name);
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8').replaceAll(previous.address, proof.address).replaceAll(previous.transaction, proof.hash);
      fs.writeFileSync(file, content);
    }
  }
  for (const relative of ['.env', '.env.example', 'frontend/.env', 'frontend/.env.local']) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file) && relative.startsWith('frontend/')) continue;
    let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const key of ['GENLAYER_CLAIMLINE_CONTRACT', 'VITE_GENLAYER_CLAIMLINE_CONTRACT']) {
      const expression = new RegExp(`^${key}=.*$`, 'm');
      content = expression.test(content) ? content.replace(expression, `${key}=${proof.address}`) : content.trimEnd() + `\n${key}=${proof.address}\n`;
    }
    fs.writeFileSync(file, content);
  }
  console.log('Synced verified deployment manifest and local contract environment variables:', proof.address);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncDeployment(JSON.parse(fs.readFileSync(path.join(root, 'verification/deployment.json'), 'utf8')));
}
