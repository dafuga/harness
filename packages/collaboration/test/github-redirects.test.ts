import { expect, test } from 'vitest';
import { githubTransport } from '../src/utils/githubTransport';
import { githubLfs } from '../src/utils/githubLfs';
import { sourceRepository } from './githubFixture';
import type { GitHubOptions } from '../src/models/Collaboration.types';

test.each(['api', 'batch', 'download'] as const)(
	'%s uses Workers-compatible manual redirects and refuses credential forwarding',
	async (stage) => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const oid = 'a'.repeat(64);
		let cancelled = 0;
		const options: GitHubOptions = {
			repository: sourceRepository,
			token: async () => 'synthetic-installation-secret',
			fetch: async (input, init) => {
				const url = String(input);
				calls.push({ url, init });
				if (stage === 'download' && url.includes('/objects/batch'))
					return Response.json({
						objects: [
							{
								oid,
								size: 1,
								actions: {
									download: {
										href: 'https://media.githubusercontent.com/synthetic',
										header: { 'X-Synthetic': 'storage-only' }
									}
								}
							}
						]
					});
				return redirectResponse(() => {
					cancelled++;
				});
			}
		};
		const pointer = new TextEncoder().encode(
			`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize 1\n`
		);
		const run =
			stage === 'api'
				? githubTransport(options, 'read').request('', { statuses: [307] })
				: githubLfs(options, pointer);
		await expect(run).rejects.toMatchObject({
			message: `Collaboration ${stage === 'api' ? 'github' : 'lfs'}-unavailable`
		});
		expect(calls).toHaveLength(stage === 'download' ? 2 : 1);
		expect(cancelled).toBe(1);
		expect(calls.every((call) => call.init?.redirect === 'manual')).toBe(true);
		expect(calls.some((call) => call.url.includes('untrusted.invalid'))).toBe(false);
		if (stage === 'download') {
			expect(JSON.stringify(calls[1].init?.headers)).not.toContain('synthetic-installation-secret');
			expect(calls[1].init?.headers).toEqual({ 'X-Synthetic': 'storage-only' });
		}
	}
);

function redirectResponse(cancel: () => void): Response {
	return new Response(
		new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('private provider body'));
			},
			cancel
		}),
		{ status: 307, headers: { location: 'https://untrusted.invalid/?secret=private-location' } }
	);
}

test('unreadable API response bodies remain opaque after manual response handling', async () => {
	const options: GitHubOptions = {
		repository: sourceRepository,
		token: async () => 'synthetic',
		fetch: async () => new Response('private-not-json')
	};
	await expect(githubTransport(options, 'read').request('')).rejects.toMatchObject({
		message: 'Collaboration github-unavailable',
		code: 'github-unavailable'
	});
});
