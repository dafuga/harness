import { expect, test } from 'vitest';
import { githubLfs } from '../src/utils/create-git-hub-source/githubLfs';
import { digest } from '../src/utils/parseCollaborationInput';
import { sourceRepository } from './githubFixture';
import type { GitHubOptions } from '../src/models/Collaboration.types';
test('LFS batch download checks SHA and size, never forwards installation secret to signed storage', async () => {
	const bytes = new TextEncoder().encode('synthetic binary fixture');
	const oid = await digest(bytes),
		pointer = new TextEncoder().encode(
			`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${bytes.length}\n`
		);
	let corrupt = false,
		unsafe = false;
	const urls: string[] = [];
	const options: GitHubOptions = {
		repository: sourceRepository,
		async token() {
			return 'private-installation-token';
		},
		async fetch(input, init) {
			const url = String(input);
			urls.push(url);
			if (url.includes('/objects/batch')) {
				expect(JSON.parse(String(init?.body))).toMatchObject({
					operation: 'download',
					objects: [{ oid, size: bytes.length }]
				});
				return new Response(
					JSON.stringify({
						objects: [
							{
								oid,
								size: bytes.length,
								actions: {
									download: {
										href: unsafe
											? 'http://127.0.0.1/private'
											: 'https://media.githubusercontent.com/private?signed=secret'
									}
								}
							}
						]
					})
				);
			}
			expect(JSON.stringify(init)).not.toContain('private-installation-token');
			return new Response(corrupt ? new Uint8Array(bytes.length) : bytes);
		}
	};
	expect(await githubLfs(options, pointer)).toEqual(bytes);
	corrupt = true;
	await expect(githubLfs(options, pointer)).rejects.toMatchObject({ code: 'lfs-unavailable' });
	unsafe = true;
	await expect(githubLfs(options, pointer)).rejects.toMatchObject({ code: 'lfs-unavailable' });
	expect(urls.some((url) => url.includes('127.0.0.1'))).toBe(false);
	await expect(
		githubLfs(options, new TextEncoder().encode('version https://git-lfs.github.com/spec/v1\nbad'))
	).rejects.toMatchObject({ code: 'invalid-lfs-pointer' });
});
