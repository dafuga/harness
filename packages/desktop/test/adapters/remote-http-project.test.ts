import { createServer } from 'node:http';
import { once } from 'node:events';
import { test, expect, vi } from 'vitest';
import { RemoteHttpProjectAdapter } from '../../src/adapters/RemoteHttpProjectAdapter';
const origin = 'https://harness.example.invalid';
const actor = {
	id: 'google:fixture',
	email: 'fixture@example.invalid',
	name: 'Fixture',
	emailVerified: true
};
const projectId = '10000000-0000-4000-8000-000000000001';
const input = {
	projectId,
	requestId: '10000000-0000-4000-8000-000000000002',
	anchor: {
		branch: 'main',
		commit: 'a'.repeat(40),
		entityId: 'page.home',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	},
	text: 'Human shared comment'
};
function adapter(fetcher: typeof fetch) {
	return new RemoteHttpProjectAdapter({
		origin,
		credentials: async () => ({ origin, principalId: actor.id, token: 'fixture-private-token' }),
		fetch: fetcher
	});
}
test('shared comments are acknowledged only with matching server actor/project/request and actual commit', async () => {
	const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		expect(init?.redirect).toBe('error');
		expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-private-token');
		expect(String(url)).not.toContain('fixture-private-token');
		if (String(url).endsWith('/api/auth/status'))
			return Response.json({ actor, configured: true, clientId: 'fixture' });
		expect(String(url)).toBe(`${origin}/api/projects/${projectId}/comments`);
		return Response.json({
			id: 'thread',
			projectId,
			anchor: input.anchor,
			comments: [
				{ id: 'message', requestId: input.requestId, actor, text: input.text, createdAt: 'now' }
			],
			collaborationCommit: 'b'.repeat(40)
		});
	});
	const result = await adapter(request as unknown as typeof fetch).addComment(input);
	expect(result.collaborationCommit).toBe('b'.repeat(40));
	expect(request).toHaveBeenCalledTimes(2);
});
test('unknown session never reaches project routes and wrong-project or unacknowledged writes are refused', async () => {
	const denied = vi.fn(async () => Response.json({ actor: null, configured: true }));
	await expect(adapter(denied as unknown as typeof fetch).addComment(input)).rejects.toThrow(
		'session'
	);
	expect(denied).toHaveBeenCalledTimes(1);
	const malformed = vi.fn(async (url: string | URL | Request) =>
		Response.json(
			String(url).endsWith('/api/auth/status')
				? { actor }
				: { projectId: 'another', comments: [], collaborationCommit: null }
		)
	);
	await expect(adapter(malformed as unknown as typeof fetch).addComment(input)).rejects.toThrow();
});
test('transport rejects credential URLs, arbitrary HTTP and redirects instead of forwarding secrets', async () => {
	for (const bad of [
		'http://example.com',
		'https://token@example.com',
		'https://example.com/path',
		'https://example.com?token=x'
	])
		expect(
			() => new RemoteHttpProjectAdapter({ origin: bad, credentials: async () => null })
		).toThrow();
	const redirected = vi.fn(async () => {
		throw new Error('redirect https://secret.example/token');
	});
	await expect(adapter(redirected as unknown as typeof fetch).listProjects()).rejects.toThrow(
		'Hosted request failed'
	);
	await expect(adapter(redirected as unknown as typeof fetch).listProjects()).rejects.not.toThrow(
		'secret.example'
	);
});

test('real localhost HTTP exchanges keep bearer credentials out of URLs and deny changed principals', async () => {
	const seen: { url: string; authorization: string | undefined }[] = [];
	let wrongPrincipal = false;
	const server = createServer((request, response) => {
		seen.push({ url: request.url!, authorization: request.headers.authorization });
		response.setHeader('content-type', 'application/json');
		response.end(
			JSON.stringify(
				request.url === '/api/auth/status'
					? { actor: { ...actor, id: wrongPrincipal ? 'different' : actor.id } }
					: [{ id: projectId, name: 'Synthetic private project', role: 'commenter' }]
			)
		);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	try {
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Fixture listener unavailable');
		const localOrigin = `http://127.0.0.1:${address.port}`;
		const client = new RemoteHttpProjectAdapter({
			origin: localOrigin,
			credentials: async () => ({
				origin: localOrigin,
				principalId: actor.id,
				token: 'private-fixture'
			})
		});
		expect(await client.listProjects()).toEqual([
			{ id: projectId, name: 'Synthetic private project', kind: 'shared' }
		]);
		expect(seen.map((request) => request.url)).toEqual(['/api/auth/status', '/api/projects']);
		expect(seen.every((request) => request.authorization === 'Bearer private-fixture')).toBe(true);
		wrongPrincipal = true;
		await expect(client.listProjects()).rejects.toThrow('principal');
		expect(seen.map((request) => request.url)).toEqual([
			'/api/auth/status',
			'/api/projects',
			'/api/auth/status'
		]);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
});
test('real HTTP comment response must acknowledge the exact request and never calls a run endpoint', async () => {
	const routes: string[] = [];
	const server = createServer((request, response) => {
		void (async () => {
			routes.push(request.url!);
			response.setHeader('content-type', 'application/json');
			if (request.url === '/api/auth/status') {
				response.end(JSON.stringify({ actor }));
				return;
			}
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(Buffer.from(chunk));
			const body = JSON.parse(Buffer.concat(chunks).toString());
			response.end(
				JSON.stringify({
					id: 'thread',
					projectId: body.projectId,
					anchor: body.anchor,
					comments: [
						{ id: 'message', requestId: body.requestId, actor, text: body.text, createdAt: 'now' }
					],
					collaborationCommit: 'c'.repeat(40)
				})
			);
		})().catch(() => {
			response.statusCode = 500;
			response.end('fixture failed');
		});
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	try {
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Fixture listener unavailable');
		const localOrigin = `http://127.0.0.1:${address.port}`;
		const client = new RemoteHttpProjectAdapter({
			origin: localOrigin,
			credentials: async () => ({
				origin: localOrigin,
				principalId: actor.id,
				token: 'synthetic-session'
			})
		});
		expect((await client.addComment(input)).collaborationCommit).toBe('c'.repeat(40));
		expect(routes).toEqual(['/api/auth/status', `/api/projects/${projectId}/comments`]);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
});
