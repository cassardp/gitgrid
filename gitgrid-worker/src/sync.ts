import { getSessionUser, decryptToken } from './auth';

const GITHUB_API = 'https://api.github.com';

export async function handleSync(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const dbUser = await env.DB.prepare('SELECT access_token, username FROM users WHERE id = ?')
		.bind(user.id).first();
	if (!dbUser) return Response.json({ error: 'User not found' }, { status: 404 });

	const token = await decryptToken(dbUser.access_token as string, env.HMAC_KEY);

	// Fetch GitHub profile
	const profileRes = await fetch(`${GITHUB_API}/users/${encodeURIComponent(dbUser.username as string)}`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'User-Agent': 'GitGrid',
			'Accept': 'application/json',
		},
	});
	if (!profileRes.ok) return Response.json({ error: 'GitHub API error' }, { status: 502 });
	const profile = await profileRes.json() as any;

	// Fetch all public repos (paginated)
	const repos: any[] = [];
	let page = 1;
	while (true) {
		const res = await fetch(
			`${GITHUB_API}/user/repos?per_page=100&page=${page}&type=owner&sort=updated`, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'User-Agent': 'GitGrid',
				'Accept': 'application/json',
			},
		});
		if (!res.ok) break;
		const batch = await res.json() as any[];
		if (batch.length === 0) break;
		repos.push(...batch);
		if (batch.length < 100) break;
		page++;
	}

	const data = {
		user: {
			login: profile.login,
			name: profile.name,
			avatar_url: profile.avatar_url,
			bio: profile.bio,
			html_url: profile.html_url,
			twitter_username: profile.twitter_username || null,
			blog: profile.blog || null,
		},
		repos: repos.map(r => ({
			name: r.name,
			full_name: r.full_name,
			description: r.description,
			html_url: r.html_url,
			homepage: r.homepage,
			language: r.language,
			stargazers_count: r.stargazers_count,
			fork: r.fork,
			private: r.private,
			topics: r.topics || [],
			license: r.license ? r.license.spdx_id : null,
			created_at: r.created_at,
			updated_at: r.updated_at,
			pushed_at: r.pushed_at,
		})),
		synced_at: new Date().toISOString(),
	};

	// Store in D1
	await env.DB.prepare('UPDATE users SET repos_data = ?, updated_at = datetime(\'now\') WHERE id = ?')
		.bind(JSON.stringify(data), user.id).run();

	return Response.json(data);
}
