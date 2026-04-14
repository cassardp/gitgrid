import { handleLogin, handleCallback, handleLogout, handleMe, handleDeleteAccount } from './auth';
import { handleGetConfig, handlePutConfig } from './config';
import { handleSync } from './sync';
import { handleUploadImage, handleListImages, handleDeleteImage, handleServeImage } from './images';
import { handleGetPortfolio } from './portfolio';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const url = new URL(request.url);
			const path = url.pathname;
			const method = request.method;

			// Auth routes
			if (path === '/api/auth/login') return handleLogin(env);
			if (path === '/api/auth/github') return handleCallback(request, env);
			if (path === '/api/auth/logout' && method === 'POST') return handleLogout();
			if (path === '/api/auth/me') return handleMe(request, env);
			if (path === '/api/auth/delete' && method === 'DELETE') return handleDeleteAccount(request, env);

			// Config routes
			if (path === '/api/config' && method === 'PUT') return handlePutConfig(request, env);
			if (path.startsWith('/api/config/')) {
				const username = path.split('/')[3];
				return handleGetConfig(username, env);
			}

			// Portfolio data (public)
			if (path.startsWith('/api/portfolio/')) {
				const username = path.split('/')[3];
				return handleGetPortfolio(username, request, env, ctx);
			}

			// Sync route
			if (path === '/api/sync' && method === 'POST') return handleSync(request, env);

			// Image routes
			if (path === '/api/images' && method === 'POST') return handleUploadImage(request, env);
			if (path === '/api/images' && method === 'GET') return handleListImages(request, env);
			if (path === '/api/images' && method === 'DELETE') return handleDeleteImage(request, env);

			// Serve images from R2
			if (path.startsWith('/img/')) {
				const key = path.slice(5);
				return handleServeImage(key, env);
			}

			// robots.txt
			if (path === '/robots.txt') {
				return new Response(
					'User-agent: *\nAllow: /\n\nSitemap: https://gitgrid.app/sitemap.xml',
					{ headers: { 'Content-Type': 'text/plain' } }
				);
			}

			// sitemap.xml — dynamic from D1
			if (path === '/sitemap.xml') {
				const { results } = await env.DB.prepare(
					'SELECT username FROM users ORDER BY username'
				).all();
				const urls = results.map((r: any) =>
					`  <url><loc>https://gitgrid.app/${esc(r.username)}</loc></url>`
				).join('\n');
				return new Response(
					`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://gitgrid.app/</loc></url>\n${urls}\n</urlset>`,
					{ headers: { 'Content-Type': 'application/xml' } }
				);
			}

			// Inject OG meta tags + JSON-LD for /:username routes
			const segments = path.split('/').filter(Boolean);
			if (segments.length === 1) {
				const username = segments[0];
				const row = await env.DB.prepare(
					'SELECT config, repos_data FROM users WHERE username = ?'
				).bind(username).first();

				if (row) {
					const config = JSON.parse(row.config as string || '{}');
					const reposData = JSON.parse(row.repos_data as string || '{}');
					const user = reposData.user || {};
					const repos = (reposData.repos || []).filter((r: any) => !r.private || r.homepage);
					const name = esc(config.title || user.name || user.login || username);
					const bio = esc(config.bio || user.bio || '');
					const avatar = user.avatar_url ? esc(user.avatar_url + '&s=400') : '';

					const ogTags = [
						`<title>${name} — GitGrid</title>`,
						`<meta property="og:title" content="${name} — GitGrid">`,
						bio && `<meta property="og:description" content="${bio}">`,
						avatar && `<meta property="og:image" content="${avatar}">`,
						`<meta property="og:url" content="https://gitgrid.app/${esc(username)}">`,
						`<meta property="og:type" content="profile">`,
						`<meta name="twitter:card" content="summary">`,
						`<meta name="twitter:title" content="${name} — GitGrid">`,
						bio && `<meta name="twitter:description" content="${bio}">`,
						avatar && `<meta name="twitter:image" content="${avatar}">`,
					].filter(Boolean).join('\n    ');

					// JSON-LD structured data
					const jsonLd: any = {
						'@context': 'https://schema.org',
						'@type': 'ProfilePage',
						mainEntity: {
							'@type': 'Person',
							name: config.title || user.name || user.login || username,
							url: `https://gitgrid.app/${username}`,
							...(user.avatar_url && { image: user.avatar_url }),
							...(config.bio || user.bio ? { description: config.bio || user.bio } : {}),
							...(user.html_url && { sameAs: [user.html_url] }),
						},
					};

					if (repos.length > 0) {
						jsonLd.mainEntity.knowsAbout = repos
							.filter((r: any) => r.language)
							.map((r: any) => r.language)
							.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

						jsonLd.hasPart = repos.slice(0, 12).map((r: any) => ({
							'@type': 'SoftwareSourceCode',
							name: r.name,
							...(r.description && { description: r.description }),
							...(r.homepage ? { url: r.homepage } : { url: r.html_url }),
							...(r.language && { programmingLanguage: r.language }),
							codeRepository: r.html_url,
						}));
					}

					const ldScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

					const assetRes = await env.ASSETS.fetch(request);
					const html = (await assetRes.text()).replace('<title>Portfolio</title>', ogTags + '\n    ' + ldScript);
					return new Response(html, {
						headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' },
					});
				}
			}

			// Let assets middleware handle static files and SPA fallback
			return env.ASSETS.fetch(request);
		} catch (e) {
			console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e), path: new URL(request.url).pathname }));
			return Response.json({ error: 'Internal server error' }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

function esc(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
