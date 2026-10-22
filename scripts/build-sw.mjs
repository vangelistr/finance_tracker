// Writes public/sw.js from the template with the current Next.js build id, so every build ships new cache names.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const buildId = (await readFile('.next/BUILD_ID', 'utf8').catch(() => 'dev')).trim();
const template = await readFile('src/pwa/sw.template.js', 'utf8');
await mkdir('public', { recursive: true });
await writeFile('public/sw.js', template.replaceAll('__BUILD_ID__', buildId.replace(/[^A-Za-z0-9_-]/g, '')));
console.log(`public/sw.js written for build ${buildId}`);
