export async function handleGetPortfolio(username: string, env: Env): Promise<Response> {
	const user = await env.DB.prepare(
		'SELECT username, config, repos_data FROM users WHERE username = ?'
	).bind(username).first();

	if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

	const config = JSON.parse(user.config as string || '{}');
	const reposData = JSON.parse(user.repos_data as string || '{}');

	return Response.json({
		config,
		user: reposData.user || null,
		repos: reposData.repos || [],
		synced_at: reposData.synced_at || null,
	});
}
