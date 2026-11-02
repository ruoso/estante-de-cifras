// build-device.js — `npm run build:device`: the reMarkable reader's bundle and
// manifest into dist/device/, and its test fixture into dist-test/device/,
// outside the served tree (reader.bundle). Prints paths and the hash only.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDevice } from '../src/device/build.js';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const rel = (p) => path.relative(appDir, p);

const { bundlePath, manifestPath, fixturePath, manifest } = await buildDevice({
  outDir: 'dist/device',
  fixtureDir: 'dist-test/device',
});
console.log(`device bundle  ${rel(bundlePath)}  sha256 ${manifest.bundle.sha256}`);
console.log(`device manifest ${rel(manifestPath)}`);
console.log(`device fixture ${rel(fixturePath)}`);
