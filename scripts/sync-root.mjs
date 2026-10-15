import {copyFile,realpath,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
// Optional convenience for this workspace. The Git checkout is the source of truth;
// the root receives the already-tested single-file deployment artifact.
const cwd=await realpath('.');
if(basename(cwd)!=='repo')throw Error('Run from the canonical repo checkout');
await copyFile('dist/worker.js',resolve(cwd,'../worker.js'));
await copyFile('wrangler.toml',resolve(cwd,'../wrangler.toml'));
await writeFile(resolve(cwd,'../DEPLOYMENT.md'),'Generated worker.js comes from repo/dist/worker.js. Edit and run checks in repo/.\nRun npm run deploy from repo/ to verify and deploy; npm run sync:root refreshes these generated copies.\n');
console.log('Root worker.js and configuration synced from the verified build.');
