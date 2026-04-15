import { getSessionUser } from './auth';

export async function handleGetConfig(username: string, env: Env): Promise<Response> {
	const user = await env.DB.prepare('SELECT username, config FROM users WHERE username = ?').bind(username).first();
	if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
	return Response.json({ username: user.username, config: JSON.parse(user.config as string || '{}') });
}

const ALLOWED_FIELDS = new Set(['title', 'bio', 'showBio', 'align', 'footer', 'showFooter', 'footerAlign', 'showLanguage', 'showStars', 'showLink', 'showTitle', 'github', 'twitter', 'blog', 'email', 'coffee', 'repos', 'sort']);
const ENUM_FIELDS: Record<string, Set<string>> = {
	align: new Set(['left', 'center', 'right']),
	footerAlign: new Set(['left', 'center', 'right']),
	sort: new Set(['stars', 'updated', 'name']),
};
const MAX_CONFIG_SIZE = 51200;
const MAX_STRING_LEN = 500;

export async function handlePutConfig(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const raw = await request.text();
	if (raw.length > MAX_CONFIG_SIZE) return Response.json({ error: 'Config too large' }, { status: 400 });

	let body: any;
	try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return Response.json({ error: 'Invalid config' }, { status: 400 });
	}

	const clean: Record<string, any> = {};
	for (const key of Object.keys(body)) {
		if (!ALLOWED_FIELDS.has(key)) continue;
		const val = body[key];
		if (key in ENUM_FIELDS) {
			if (ENUM_FIELDS[key].has(val)) clean[key] = val;
		} else if (key === 'showBio' || key === 'showFooter' || key === 'showLanguage' || key === 'showStars' || key === 'showLink' || key === 'showTitle') {
			if (typeof val === 'boolean') clean[key] = val;
		} else if (key === 'repos') {
			if (typeof val === 'object' && val !== null && !Array.isArray(val)) clean[key] = val;
		} else {
			if (typeof val === 'string') clean[key] = val.slice(0, MAX_STRING_LEN);
		}
	}

	await env.DB.prepare('UPDATE users SET config = ?, updated_at = datetime(\'now\') WHERE id = ?')
		.bind(JSON.stringify(clean), user.id).run();

	return Response.json({ ok: true });
}
