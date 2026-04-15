const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_USER = 'https://api.github.com/user';
const COOKIE_NAME = 'gitgrid_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const STATE_COOKIE = 'gitgrid_oauth_state';
const STATE_MAX_AGE = 600; // 10 minutes

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
	const hexPairs = sig.match(/.{2}/g);
	if (!hexPairs) return null;
	const sigBytes = new Uint8Array(hexPairs.map(h => parseInt(h, 16)));
	const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, enc.encode(payload));
	if (!valid) return null;
	return payload;
}

function sessionCookie(value: string, maxAge: number): string {
	return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

async function getEncryptionKey(hmacKey: string): Promise<CryptoKey> {
	const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hmacKey + ':encrypt'));
	return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string, hmacKey: string): Promise<string> {
	const key = await getEncryptionKey(hmacKey);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
	return `enc:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(ct)))}`;
}

export async function decryptToken(stored: string, hmacKey: string): Promise<string> {
	if (!stored.startsWith('enc:')) return stored;
	const [, ivB64, ctB64] = stored.split(':');
	const key = await getEncryptionKey(hmacKey);
	const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
	const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
	return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
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
	const state = crypto.randomUUID();
	const url = `${GITHUB_AUTHORIZE}?client_id=${env.GITHUB_CLIENT_ID}&state=${state}`;
	return new Response(null, {
		status: 302,
		headers: {
			'Location': url,
			'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${STATE_MAX_AGE}`,
		},
	});
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) return new Response('Missing code or state', { status: 400 });

	const cookieHeader = request.headers.get('Cookie') || '';
	const stateMatch = cookieHeader.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
	if (!stateMatch || stateMatch[1] !== state) {
		return new Response('Invalid state', { status: 403 });
	}

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

	const encAccessToken = await encryptToken(tokenData.access_token, env.HMAC_KEY);
	const encRefreshToken = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token, env.HMAC_KEY) : null;

	if (existing) {
		userId = existing.id as number;
		await env.DB.prepare(
			'UPDATE users SET username = ?, access_token = ?, refresh_token = ?, updated_at = datetime(\'now\') WHERE id = ?'
		).bind(ghUser.login, encAccessToken, encRefreshToken, userId).run();
	} else {
		const result = await env.DB.prepare(
			'INSERT INTO users (github_id, username, access_token, refresh_token) VALUES (?, ?, ?, ?)'
		).bind(ghUser.id, ghUser.login, encAccessToken, encRefreshToken).run();
		userId = result.meta.last_row_id as number;
	}

	const signed = await sign(String(userId), env.HMAC_KEY);
	const headers = new Headers();
	headers.set('Location', `/${ghUser.login}`);
	headers.append('Set-Cookie', sessionCookie(signed, COOKIE_MAX_AGE));
	headers.append('Set-Cookie', `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
	return new Response(null, { status: 302, headers });
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
	await Promise.all(images.results.map(img => env.IMAGES.delete(img.r2_key as string)));

	// Delete from D1 (images/views cascade via FK, but explicit for clarity)
	await env.DB.prepare('DELETE FROM images WHERE user_id = ?').bind(user.id).run();
	await env.DB.prepare('DELETE FROM views WHERE user_id = ?').bind(user.id).run();
	await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': sessionCookie('', 0),
		},
	});
}
