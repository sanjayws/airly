import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./tests/browser',workers:1,fullyParallel:false,
  use:{browserName:'chromium',serviceWorkers:'block',launchOptions:{
    executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),
    args:['--no-sandbox']
  }},reporter:'list'
});
