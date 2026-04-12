import { getSessionUser } from './auth';

export async function handleGetConfig(username: string, env: Env): Promise<Response> {
	const user = await env.DB.prepare('SELECT username, config FROM users WHERE username = ?').bind(username).first();
	if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
	return Response.json({ username: user.username, config: JSON.parse(user.config as string || '{}') });
}

export async function handlePutConfig(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json() as any;
	const config = JSON.stringify(body);
	await env.DB.prepare('UPDATE users SET config = ?, updated_at = datetime(\'now\') WHERE id = ?')
		.bind(config, user.id).run();

	return Response.json({ ok: true });
}
