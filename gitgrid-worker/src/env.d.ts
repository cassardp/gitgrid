declare interface Env {
	DB: D1Database;
	IMAGES: R2Bucket;
	ASSETS: Fetcher;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	HMAC_KEY: string;
}
