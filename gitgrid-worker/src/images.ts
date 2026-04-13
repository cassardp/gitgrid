import { getSessionUser } from './auth';

const ALLOWED_IMAGE_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' };
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const REPO_NAME_RE = /^[a-zA-Z0-9._-]+$/;

export async function handleUploadImage(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const repoName = formData.get('repo') as string | null;
	if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

	const ext = ALLOWED_IMAGE_TYPES[file.type];
	if (!ext) return Response.json({ error: 'Invalid file type' }, { status: 400 });
	if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'File too large' }, { status: 400 });
	if (repoName && !REPO_NAME_RE.test(repoName)) return Response.json({ error: 'Invalid repo name' }, { status: 400 });

	const r2Key = `${user.username}/${repoName || '_default'}/${Date.now()}.${ext}`;

	await env.IMAGES.put(r2Key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	await env.DB.prepare('INSERT INTO images (user_id, r2_key, repo_name) VALUES (?, ?, ?)')
		.bind(user.id, r2Key, repoName).run();

	return Response.json({ key: r2Key });
}

export async function handleListImages(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const images = await env.DB.prepare('SELECT id, r2_key, repo_name, created_at FROM images WHERE user_id = ?')
		.bind(user.id).all();

	return Response.json({ images: images.results });
}

export async function handleDeleteImage(request: Request, env: Env): Promise<Response> {
	const user = await getSessionUser(request, env);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const { key } = await request.json() as { key: string };
	if (!key) return Response.json({ error: 'Missing key' }, { status: 400 });

	// Verify ownership
	const image = await env.DB.prepare('SELECT id FROM images WHERE user_id = ? AND r2_key = ?')
		.bind(user.id, key).first();
	if (!image) return Response.json({ error: 'Not found' }, { status: 404 });

	await env.IMAGES.delete(key);
	await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(image.id).run();

	return Response.json({ ok: true });
}

export async function handleServeImage(key: string, env: Env): Promise<Response> {
	if (!key || key.includes('..') || key.startsWith('/')) {
		return new Response('Invalid key', { status: 400 });
	}
	const object = await env.IMAGES.get(key);
	if (!object) return new Response('Not found', { status: 404 });

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType || 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}
