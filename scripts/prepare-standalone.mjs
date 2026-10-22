// Copies static assets next to the standalone server so `npm start` serves them like the Docker image does.
import { cp, rm } from 'node:fs/promises';

await rm('.next/standalone/public', { recursive: true, force: true });
await rm('.next/standalone/.next/static', { recursive: true, force: true });
await cp('public', '.next/standalone/public', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
console.log('standalone assets copied');
