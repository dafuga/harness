import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPlanning } from '../../planning/src/index/index';
import { fixture, settled, git } from './run-fixture';

test.each(['functions', 'services', 'configs'] as const)(
	'%s Plan comments retain the exact notes version through later revisions',
	async (category) => {
		const f = await fixture();
		const entity = await f.planning.createPlan({
			category,
			title: 'Headless',
			goal: 'Describe behavior'
		});
		const thread = await f.planning.openThread({
			entityId: entity.id,
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		});
		const request = { ...f.request, entityId: entity.id, threadId: thread.id };
		await settled(f, request);
		const api = await createPlanning(f.root);
		const saved = await api.readPlan({ unitId: entity.id });
		const version = saved.versions[0];
		expect(version.images).toEqual([]);
		expect(saved.threads[0].messages.at(-1)?.references).toEqual([
			{ kind: 'notes', version: 'v001', sha256: version.notes!.sha256 }
		]);
		const messages = await f.planning.messages(
			entity.id,
			thread.id,
			git(f.root, 'rev-parse', 'HEAD')
		);
		expect(messages.at(-1)).toMatchObject({ version: 'v001', imageSha256: null, author: 'agent' });
		const path = join(f.root, saved.path, 'threads', thread.id, 'messages.ndjson');
		const previous = await readFile(path);
		await settled(f, request);
		const later = await f.planning.messages(entity.id, thread.id, git(f.root, 'rev-parse', 'HEAD'));
		expect(
			later.filter((message) => message.author === 'agent').map((message) => message.version)
		).toEqual(['v001', 'v002']);
		expect((await readFile(path)).subarray(0, previous.length)).toEqual(previous);
		expect(git(f.root, 'status', '--porcelain')).toBe('');
		expect(f.generator.generateImage).not.toHaveBeenCalled();
	},
	30000
);

test('visual comments keep image links and cannot fall back to their design notes', async () => {
	const f = await fixture();
	// A case of one design: it asks for a single design option.
	await settled(f, { ...f.request, designOptions: 1 });
	const api = await createPlanning(f.root);
	const plan = await api.readPlan({ unitId: f.request.entityId });
	const version = plan.versions[0];
	expect(version.notes).not.toBeNull();
	expect(plan.threads[0].messages.at(-1)?.references).toEqual([
		{
			kind: 'image',
			version: 'v001',
			file: version.images[0].file,
			sha256: version.images[0].sha256
		}
	]);
	const invalid = await f.planning.appendMessage({
		entityId: f.request.entityId,
		threadId: f.request.threadId,
		author: 'user',
		text: 'No image selected',
		mode: 'plan',
		provider: null,
		model: null,
		version: 'v001',
		imageSha256: null
	});
	expect(invalid).toMatchObject({ version: null, imageSha256: null });
	const loaded = await api.readPlan({ unitId: f.request.entityId });
	expect(loaded.threads[0].messages.at(-1)?.references).toEqual([]);
}, 15000);
