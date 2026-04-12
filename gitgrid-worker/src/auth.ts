const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_USER = 'https://api.github.com/user';
const COOKIE_NAME = 'gitgrid_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sign(payload: string, key: string): Promise<string> {
	const enc = new TextEncoder();
	const cryptoKey = await crypto.subtle.importKey(
		'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
	const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
	return `${payload}.${hex}`;
}

async function verify(cookie: string, key: string): Promise<string | null> {
	const idx = cookie.lastIndexOf('.');
	if (idx === -1) return null;
	const payload = cookie.slice(0, idx);
	const sig = cookie.slice(idx + 1);
	const enc = new TextEncoder();
	const cryptoKey = await crypto.subtle.importKey(
		'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
	);
	const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map(h => parseInt(h, 16)));
	const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, enc.encode(payload));
	if (!valid) return null;
	return payload;
}

function sessionCookie(value: string, maxAge: number): string {
	return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export async function getSessionUser(request: Request, env: Env) {
	const header = request.headers.get('Cookie') || '';
	const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
	if (!match) return null;
	const userId = await verify(match[1], env.HMAC_KEY);
	if (!userId) return null;
	const user = await env.DB.prepare('SELECT id, github_id, username FROM users WHERE id = ?').bind(userId).first();
	return user;
}

export async function handleLogin(env: Env): Promise<Response> {
	const url = `${GITHUB_AUTHORIZE}?client_id=${env.GITHUB_CLIENT_ID}`;
	return Response.redirect(url, 302);
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	if (!code) return new Response('Missing code', { status: 400 });

	// Exchange code for access token
	const tokenRes = await fetch(GITHUB_TOKEN, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
		}),
	});
	const tokenData = await tokenRes.json() as any;
	if (!tokenData.access_token) {
		return Response.json({ error: 'OAuth token exchange failed' }, { status: 400 });
	}

	// Fetch GitHub user
	const userRes = await fetch(GITHUB_USER, {
		headers: {
			'Authorization': `Bearer ${tokenData.access_token}`,
			'User-Agent': 'GitGrid',
			'Accept': 'application/json',
		},
	});
	if (!userRes.ok) {
		return Response.json({ error: 'Failed to fetch GitHub profile' }, { status: 502 });
	}
	const ghUser = await userRes.json() as any;

	// Upsert user in D1
	const existing = await env.DB.prepare('SELECT id FROM users WHERE github_id = ?').bind(ghUser.id).first();
	let userId: number;

	if (existing) {
		userId = existing.id as number;
		await env.DB.prepare(
			'UPDATE users SET username = ?, access_token = ?, refresh_token = ?, updated_at = datetime(\'now\') WHERE id = ?'
		).bind(ghUser.login, tokenData.access_token, tokenData.refresh_token || null, userId).run();
	} else {
		const result = await env.DB.prepare(
			'INSERT INTO users (github_id, username, access_token, refresh_token) VALUES (?, ?, ?, ?)'
		).bind(ghUser.id, ghUser.login, tokenData.access_token, tokenData.refresh_token || null).run();
		userId = result.meta.last_row_id as number;
	}

	const signed = await sign(String(userId), env.HMAC_KEY);
	return new Response(null, {
		status: 302,
		headers: {
			'Location': `/${ghUser.login}`,
			'Set-Cookie': sessionCookie(signed, COOKIE_MAX_AGE),
		},
	});
}

export async function handleLogout(): Promise<Response> {
	return new Response(null, {
		status: 302,
		headers: {
			'Location': '/',
			'Set-Cookie': sessionCookie('', 0),
		},
	});
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ user: null }, { status: 401 });
	return Response.json({ user });
}

export async function handleDeleteAccount(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const { username } = await request.json() as { username: string };
	if (username !== user.username) {
		return Response.json({ error: 'Username does not match' }, { status: 400 });
	}

	// Delete images from R2
	const images = await env.DB.prepare('SELECT r2_key FROM images WHERE user_id = ?').bind(user.id).all();
	for (const img of images.results) {
		await env.IMAGES.delete(img.r2_key as string);
	}

	// Delete from D1 (images cascade via FK, but explicit for clarity)
	await env.DB.prepare('DELETE FROM images WHERE user_id = ?').bind(user.id).run();
	await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': sessionCookie('', 0),
		},
	});
}
