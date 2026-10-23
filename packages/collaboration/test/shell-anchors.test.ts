import { measureWorkload } from '../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import type { GitHubOptions } from '../src/models/Collaboration.types';
import { createGitHubSource } from '../src/utils/create-git-hub-source/createGitHubSource';
import { base64 } from '../src/utils/githubTransport';
import { digest } from '../src/utils/parseCollaborationInput';
import { anchor, sourceRepository } from './githubFixture';

/**
 * A person may comment on a shell of a hosted project as on any entity: on the shell itself, and
 * on an image of its plan, which lives in the folder of Shells.
 */
const id = 'shell.host-frame';
const path = 'src/shells/host-frame';
const manifest = {
	schemaVersion: 1,
	id,
	kind: 'shell',
	title: 'Host frame',
	responsibility: 'Frames the workspace of a host.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: ['src/shells/HostFrame.svelte'], symbols: [] },
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'src/shells/HostFrame.svelte',
		targets: [{ kind: 'module', entry: 'src/shells/HostFrame.svelte' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

async function objects(files: Record<string, Uint8Array>) {
	const entries: Array<{ path: string; sha: string; type: string; mode: string }> = [];
	const blobs = new Map<string, Uint8Array>();
	for (const [file, bytes] of Object.entries(files)) {
		const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
		const value = new Uint8Array(header.length + bytes.length);
		value.set(header);
		value.set(bytes, header.length);
		const sha = await digest(value, 'SHA-1');
		entries.push({ path: file, sha, type: 'blob', mode: '100644' });
		blobs.set(sha, bytes);
	}
	return { entries, blobs };
}

async function hosted() {
	const image = new TextEncoder().encode('synthetic shell image bytes');
	const imageSha256 = await digest(image);
	const files: Record<string, Uint8Array> = { [`${path}/designs/v001/default-desktop.png`]: image };
	const json: Record<string, unknown> = {
		[`specification/units/${id}.json`]: manifest,
		[`${path}/plan.json`]: { unitId: id, category: 'shell', slug: 'host-frame', path },
		[`${path}/designs/v001/design.json`]: {
			unitId: id,
			version: 'v001',
			images: [
				{ file: 'default-desktop.png', sha256: imageSha256, state: 'default', viewport: 'desktop' }
			]
		}
	};
	for (const [name, value] of Object.entries(json))
		files[name] = new TextEncoder().encode(JSON.stringify(value));
	const { entries, blobs } = await objects(files);
	const [tip, tree] = ['b'.repeat(40), 'c'.repeat(40)];
	const options: Omit<GitHubOptions, 'repository'> = {
		token: async () => 'private',
		async fetch(input) {
			const asked = new URL(String(input)).pathname;
			let value: unknown = { id: 202, private: true };
			if (asked.includes('/git/ref/'))
				value = { ref: `refs/heads/${anchor.branch}`, object: { sha: tip } };
			if (asked.includes('/git/commits/'))
				value = { sha: asked.endsWith(tip) ? tip : anchor.commit, tree: { sha: tree } };
			if (asked.includes('/compare/'))
				value = { status: 'ahead', merge_base_commit: { sha: anchor.commit } };
			if (asked.includes('/git/trees/')) value = { sha: tree, truncated: false, tree: entries };
			if (asked.includes('/git/blobs/')) {
				const sha = asked.split('/').at(-1)!;
				const bytes = blobs.get(sha)!;
				value = { sha, size: bytes.length, encoding: 'base64', content: base64(bytes) };
			}
			return new Response(JSON.stringify(value));
		}
	};
	return { adapter: createGitHubSource(options), imageSha256 };
}

test('a comment on a shell, and on an image of its plan, is anchored like one on any entity', () =>
	measureWorkload(
		'collaboration.function.validate-git-hub-anchor',
		'layout-catalog-behavior',
		async () => {
			const { adapter, imageSha256 } = await hosted();
			const shell = { ...anchor, entityId: id };
			await expect(adapter.validateAnchor(sourceRepository, shell)).resolves.toBeUndefined();
			const pictured = {
				...shell,
				version: 'v001',
				imageSha256,
				state: 'default',
				viewport: 'desktop',
				region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
			};
			await expect(adapter.validateAnchor(sourceRepository, pictured)).resolves.toBeUndefined();
		}
	));
