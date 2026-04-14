import { getSessionUser } from './auth';

export async function handleGetPortfolio(username: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const user = await env.DB.prepare(
		'SELECT id, username, config, repos_data FROM users WHERE username = ?'
	).bind(username).first();

	if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

	const config = JSON.parse(user.config as string || '{}');
	const reposData = JSON.parse(user.repos_data as string || '{}');
	let repos = reposData.repos || [];

	// Check if requester is the owner
	const sessionUser = await getSessionUser(request, env);
	const isOwner = sessionUser && sessionUser.id === user.id;

	// Visitors only see public repos + private repos with a homepage
	if (!isOwner) {
		repos = repos.filter((r: any) => !r.private || r.homepage);
		const today = new Date().toISOString().slice(0, 10);
		ctx.waitUntil(
			env.DB.prepare('INSERT INTO views (user_id, date, count) VALUES (?, ?, 1) ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1')
				.bind(user.id, today).run()
		);
	}

	const response: any = {
		config,
		user: reposData.user || null,
		repos,
		synced_at: reposData.synced_at || null,
	};

	if (isOwner) {
		const today = new Date().toISOString().slice(0, 10);
		const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
		const row = await env.DB.prepare(
			'SELECT COALESCE(SUM(CASE WHEN date = ? THEN count ELSE 0 END), 0) as today, COALESCE(SUM(count), 0) as week FROM views WHERE user_id = ? AND date >= ?'
		).bind(today, user.id, weekAgo).first();
		response.views = { today: row?.today || 0, week: row?.week || 0 };
	}

	return Response.json(response);
}
