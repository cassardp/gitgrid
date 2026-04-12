import { getSessionUser } from './auth';

export async function handleGetPortfolio(username: string, request: Request, env: Env): Promise<Response> {
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
	}

	return Response.json({
		config,
		user: reposData.user || null,
		repos,
		synced_at: reposData.synced_at || null,
	});
}
