import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	hubRaw,
	hubMaterializedHash,
	hubBlobProfile
} from '../../src/utils/development-tooling/hubRaw';

const rawContext = (bytes: Uint8Array) =>
	({ metadata: new Map([['README.md', bytes]]) }) as unknown as Parameters<typeof hubRaw>[0];

test('Returns verified prefetched Git blob bytes', async () => {
	const bytes = new TextEncoder().encode('hello');
	const entry = { path: 'README.md', sha: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0' };
	const result = await hubRaw(rawContext(bytes), entry as Parameters<typeof hubRaw>[1]);
	expect([...result]).toEqual([...bytes]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-raw',
			symbol: 'hubRaw',
			state: 'returns-verified-prefetched-git-blob-bytes',
			evidence: 'examples-cases',
			file: 'returns-verified-prefetched-git-blob-bytes.json'
		},
		[{ name: 'prefetched README bytes match the Git blob sha', input: { path: entry.path, sha: entry.sha }, output: { text: new TextDecoder().decode(result), size: result.length } }]
	);
});

test('Hashes ordinary files and Git LFS pointers', async () => {
	const ordinary = await hubMaterializedHash(new TextEncoder().encode('test'), null);
	const pointer = new TextEncoder().encode(
		'version https://git-lfs.github.com/spec/v1\noid sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\nsize 5\n'
	);
	const lfs = await hubMaterializedHash(pointer, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
	expect([ordinary, lfs]).toEqual([
		{ hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', size: 4, lfs: false },
		{ hash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', size: 5, lfs: true }
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-raw',
			symbol: 'hubMaterializedHash',
			state: 'hashes-ordinary-files-and-git-lfs-pointers',
			evidence: 'examples-cases',
			file: 'hashes-ordinary-files-and-git-lfs-pointers.json'
		},
		[
			{ name: 'ordinary content', input: { text: 'test', expected: null }, output: ordinary },
			{ name: 'valid LFS pointer', input: { text: new TextDecoder().decode(pointer), expected: lfs.hash }, output: lfs }
		]
	);
});

test('Builds a path scoped raw blob cache profile', async () => {
	const profile = await hubBlobProfile('raw', 'README.md', 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
	expect(profile).toMatch(/^raw:[a-f0-9]{64}:b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0$/);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-raw',
			symbol: 'hubBlobProfile',
			state: 'builds-a-path-scoped-raw-blob-cache-profile',
			evidence: 'examples-cases',
			file: 'builds-a-path-scoped-raw-blob-cache-profile.json'
		},
		[{ name: 'raw profile for README', input: { kind: 'raw', path: 'README.md', sha: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0' }, output: profile }]
	);
});
