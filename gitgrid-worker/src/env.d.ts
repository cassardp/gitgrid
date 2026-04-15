import type { BrowserWorker } from '@cloudflare/puppeteer';

// Secrets set via `wrangler secret put` — not in wrangler.jsonc
// Bindings (DB, IMAGES, ASSETS) are generated in worker-configuration.d.ts by `wrangler types`
declare interface Env {
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	HMAC_KEY: string;
	BROWSER: BrowserWorker;
}
