import { handleLogin, handleCallback, handleLogout, handleMe, handleDeleteAccount } from './auth';
import { handleGetConfig, handlePutConfig } from './config';
import { handleSync } from './sync';
import { handleUploadImage, handleListImages, handleDeleteImage, handleServeImage } from './images';
import { handleGetPortfolio } from './portfolio';

export default {
	async fetch(request, env, ctx): Promise<Response> {
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
			return handleGetPortfolio(username, request, env);
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

		// Let assets middleware handle static files and SPA fallback
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
