import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, fixture, git } from './planFixture';
import type { ArtifactReference } from '../src/index/index';
import { PNG } from 'pngjs';

test('notes references bind exact entity artifacts without rewriting legacy messages', async () => {
	const { root, api } = await fixture();
	const plan = await api.createPlan({
		category: 'function',
		slug: 'filter',
		title: 'Filter',
		goal: 'Filter',
		author,
		contract
	});
	const design = await api.addDesign({
		unitId: plan.value.unitId,
		prompt: 'Behavior',
		generator: { provider: 'codex', model: 'selected' },
		images: [],
		notes: 'Filter matching values'
	});
	const thread = await api.openThread({
		unitId: plan.value.unitId,
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author,
		message: { author, mode: 'plan', body: 'Legacy comment', references: [] }
	});
	const path = join(root, plan.value.path, 'threads', thread.value.id, 'messages.ndjson');
	const previous = await readFile(path);
	const reference = { kind: 'notes' as const, version: 'v001', sha256: design.value.notes!.sha256 };
	const input = {
		unitId: plan.value.unitId,
		threadId: thread.value.id,
		author,
		mode: 'plan' as const,
		body: 'Saved behavior'
	};
	const before = git(root, 'rev-parse', 'HEAD');
	for (const invalid of [
		{ ...reference, version: 'v999' },
		{ ...reference, sha256: '0'.repeat(64) },
		{ ...reference, sha256: undefined }
	]) {
		await expect(
			api.appendMessage({ ...input, references: [invalid as ArtifactReference] })
		).rejects.toThrow('Reference');
		expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
	}
	await api.appendMessage({ ...input, references: [reference] });
	const loaded = await api.readPlan({ unitId: plan.value.unitId });
	const messages = loaded.threads[0].messages;
	expect(messages[0].references).toEqual([]);
	expect(messages[1].references).toEqual([reference]);
	expect((await readFile(path)).subarray(0, previous.length)).toEqual(previous);
});

test('a visual version without notes cannot accept an absent notes hash', async () => {
	const { root, api } = await fixture();
	await api.createPlan({
		category: 'page',
		slug: 'home',
		title: 'Home',
		goal: 'Home',
		author,
		contract
	});
	await api.addDesign({
		unitId: 'page.home',
		prompt: 'Home',
		generator: { provider: 'codex', model: 'selected' },
		images: [
			{
				state: 'default',
				viewport: 'desktop',
				bytes: PNG.sync.write(new PNG({ width: 2, height: 2 }))
			}
		]
	});
	const thread = await api.openThread({
		unitId: 'page.home',
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author
	});
	const before = git(root, 'rev-parse', 'HEAD');
	await expect(
		api.appendMessage({
			unitId: 'page.home',
			threadId: thread.value.id,
			author,
			mode: 'plan',
			body: 'No notes',
			references: [
				{ kind: 'notes', version: 'v001', sha256: undefined } as unknown as ArtifactReference
			]
		})
	).rejects.toThrow('Reference');
	expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
});
