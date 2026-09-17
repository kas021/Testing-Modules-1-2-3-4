import fs from 'node:fs';
import path from 'node:path';
import { zipEntries } from './zip.mjs';

/* Rebuilds the bootstrap bundle named in catalogue.json from the module ZIPs
 * listed there. Run this after adding or replacing a module package, then run
 * scripts/build_repository.mjs and commit both the bundle and the index. */

const root = path.resolve(import.meta.dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'catalogue.json'), 'utf8'));
const bundleAbsolute = path.join(root, catalogue.bundleFile);
fs.mkdirSync(path.dirname(bundleAbsolute), { recursive: true });

const entries = [{ name: 'modules/', data: Buffer.alloc(0) }];
for (const item of catalogue.modules) {
  const source = path.join(root, item.file);
  if (!fs.existsSync(source)) throw new Error(`Missing ${item.file}`);
  entries.push({ name: `modules/${path.basename(item.file)}`, data: fs.readFileSync(source) });
}

const packed = zipEntries(entries);
fs.writeFileSync(bundleAbsolute, packed);
console.log(`Wrote ${catalogue.bundleFile} (${packed.length} bytes, ${catalogue.modules.length} modules)`);
