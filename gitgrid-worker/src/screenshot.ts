import puppeteer from '@cloudflare/puppeteer';
import { getSessionUser } from './auth';

export async function handleCaptureScreenshot(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const { repo: repoName } = await request.json() as { repo: string };
	if (!repoName || typeof repoName !== 'string') {
		return Response.json({ error: 'Missing repo name' }, { status: 400 });
	}

	// Look up repo homepage URL from repos_data
	const dbUser = await env.DB.prepare('SELECT repos_data FROM users WHERE id = ?')
		.bind(user.id).first();
	if (!dbUser) return Response.json({ error: 'User not found' }, { status: 404 });

	const reposData = JSON.parse(dbUser.repos_data as string || '{}');
	const repo = (reposData.repos || []).find((r: any) => r.name === repoName);
	if (!repo?.homepage) {
		return Response.json({ error: 'No homepage URL for this repo' }, { status: 400 });
	}

	// Validate URL — only allow http(s)
	let url: URL;
	try {
		url = new URL(repo.homepage);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return Response.json({ error: 'Invalid URL protocol' }, { status: 400 });
		}
	} catch {
		return Response.json({ error: 'Invalid homepage URL' }, { status: 400 });
	}

	// Launch headless browser and capture screenshot
	const browser = await puppeteer.launch(env.BROWSER);
	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 });
		await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 20000 });

		// Small delay for final renders (animations, lazy images)
		await new Promise(r => setTimeout(r, 1000));

		const screenshotBuffer = await page.screenshot({ type: 'webp', quality: 85 });

		// Store in R2
		const r2Key = `${user.username}/${repoName}/${Date.now()}.webp`;
		await env.IMAGES.put(r2Key, screenshotBuffer, {
			httpMetadata: { contentType: 'image/webp' },
		});

		// Record in DB
		await env.DB.prepare('INSERT INTO images (user_id, r2_key, repo_name) VALUES (?, ?, ?)')
			.bind(user.id, r2Key, repoName).run();

		return Response.json({ key: r2Key });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(JSON.stringify({ error: 'Screenshot capture failed', detail: msg, repo: repoName }));
		return Response.json({ error: 'Screenshot capture failed' }, { status: 502 });
	} finally {
		await browser.close();
	}
}
