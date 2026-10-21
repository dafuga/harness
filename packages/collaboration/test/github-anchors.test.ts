import { expect, test } from 'vitest';
import { createGitHubSource } from '../src/utils/create-git-hub-source/createGitHubSource';
import { digest } from '../src/utils/parseCollaborationInput';
import { base64 } from '../src/utils/githubTransport';
import { anchor, sourceRepository } from './githubFixture';
import type { GitHubOptions } from '../src/models/Collaboration.types';
const canonical = {
	schemaVersion: 1,
	id: anchor.entityId,
	kind: 'page',
	title: 'Activity',
	responsibility: 'Display activity',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: ['src/pages/Activity.svelte'], symbols: [] },
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'src/pages/Activity.svelte',
		targets: [{ kind: 'module', entry: 'src/pages/Activity.svelte' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};
async function fixture(corrupt = false) {
	const commit = anchor.commit,
		tip = 'b'.repeat(40),
		tree = 'c'.repeat(40);
	const image = new TextEncoder().encode('original synthetic image bytes');
	const imageSha256 = await digest(image),
		path = 'src/pages/activity';
	const files: Record<string, Uint8Array> = { [`${path}/designs/v001/default-desktop.png`]: image };
	for (const [name, value] of Object.entries({
		'specification/units/page.activity.json': corrupt
			? { ...canonical, contract: null }
			: canonical,
		[`${path}/plan.json`]: { unitId: anchor.entityId, category: 'page', slug: 'activity', path },
		[`${path}/designs/v001/design.json`]: {
			unitId: anchor.entityId,
			version: 'v001',
			images: [
				{ file: 'default-desktop.png', sha256: imageSha256, state: 'default', viewport: 'desktop' }
			]
		}
	}))
		files[name] = new TextEncoder().encode(JSON.stringify(value));
	const { entries, blobs } = await gitObjects(files);
	const options: Omit<GitHubOptions, 'repository'> = {
		async token() {
			return 'private';
		},
		async fetch(input) {
			const path = new URL(String(input)).pathname;
			let value: unknown = { id: 202, private: true };
			if (path.includes('/git/ref/'))
				value = { ref: `refs/heads/${anchor.branch}`, object: { sha: tip } };
			if (path.includes('/git/commits/'))
				value = { sha: path.endsWith(tip) ? tip : commit, tree: { sha: tree } };
			if (path.includes('/compare/'))
				value = { status: 'ahead', merge_base_commit: { sha: commit } };
			if (path.includes('/git/trees/')) value = { sha: tree, truncated: false, tree: entries };
			if (path.includes('/git/blobs/')) {
				const sha = path.split('/').at(-1)!,
					bytes = blobs.get(sha)!;
				value = { sha, size: bytes.length, encoding: 'base64', content: base64(bytes) };
			}
			return new Response(JSON.stringify(value));
		}
	};
	return { adapter: createGitHubSource(options), imageSha256 };
}
test('historical image anchors bind exact entity/version/image/state/viewport and normalized region', async () => {
	const { adapter, imageSha256 } = await fixture();
	const input = {
		...anchor,
		version: 'v001',
		imageSha256,
		state: 'default',
		viewport: 'desktop',
		region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
	};
	await expect(adapter.validateAnchor(sourceRepository, input)).resolves.toBeUndefined();
	for (const change of [
		{ state: 'other' },
		{ imageSha256: 'f'.repeat(64) },
		{ viewport: 'mobile' }
	]) {
		await expect(
			adapter.validateAnchor(sourceRepository, { ...input, ...change })
		).rejects.toMatchObject({ code: 'invalid-image' });
	}
	await expect(
		adapter.validateAnchor(sourceRepository, {
			...input,
			region: { x: 0.9, y: 0, width: 0.3, height: 1 }
		})
	).rejects.toMatchObject({ code: 'invalid-input' });
	await expect(
		adapter.validateAnchor(sourceRepository, { ...anchor, entityId: 'page.missing' })
	).rejects.toMatchObject({ code: 'invalid-entity' });
	await expect(adapter.validateAnchor(sourceRepository, anchor)).resolves.toBeUndefined();
});

async function gitObjects(files: Record<string, Uint8Array>) {
	const entries: Array<{ path: string; sha: string; type: string; mode: string }> = [],
		blobs = new Map<string, Uint8Array>();
	for (const [path, bytes] of Object.entries(files)) {
		const header = new TextEncoder().encode(`blob ${bytes.length}\0`),
			value = new Uint8Array(header.length + bytes.length);
		value.set(header);
		value.set(bytes, header.length);
		const sha = await digest(value, 'SHA-1');
		entries.push({ path, sha, type: 'blob', mode: '100644' });
		blobs.set(sha, bytes);
	}
	return { entries, blobs };
}

test('malformed canonical contracts never attest source anchors', async () => {
	const { adapter } = await fixture(true);
	await expect(adapter.validateAnchor(sourceRepository, anchor)).rejects.toMatchObject({
		code: 'invalid-input'
	});
});
