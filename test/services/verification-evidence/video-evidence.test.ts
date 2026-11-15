import { expect, test } from 'vitest';
import { VideoEvidenceService } from '../../../src/services/verification-evidence/VideoEvidenceService';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const manifest = {
	schemaVersion: 1,
	viewports: [
		{ id: 'desktop', width: 920, height: 700 },
		{ id: 'mobile', width: 390, height: 844 }
	],
	clips: ['first', 'second'].map((id) => ({
		id,
		unit: `component.${id}`,
		state: 'moving',
		viewports: ['desktop', 'mobile'],
		inputs: [`src/${id}.ts`],
		script: { path: `test/${id}.ts`, export: 'record' },
		fixture: `test/${id}.json`,
		entry: 'ready',
		exit: 'done',
		states: ['ready', 'done'],
		edges: ['finish'],
		durationSeconds: 3
	})),
	graphs: [],
	playlists: [{ id: 'all', clips: ['first', 'second'] }]
};

async function fixture(root: string) {
	for (const directory of ['src', 'test', 'specification/units'])
		await mkdir(join(root, directory), { recursive: true });
	for (const id of ['first', 'second']) {
		for (const [path, text] of [
			[`src/${id}.ts`, id],
			[`test/${id}.ts`, 'export function record() {}'],
			[`test/${id}.json`, '{}']
		])
			await writeFile(join(root, path), text);
		await writeFile(
			join(root, `specification/units/component.${id}.json`),
			JSON.stringify({
				id: `component.${id}`,
				status: 'active',
				owns: { source: [`src/${id}.ts`] },
				dependencies: []
			})
		);
	}
}

test('VideoEvidenceService runs', () => {
	expect(new VideoEvidenceService().run()).toBe('video-evidence');
});

test('clip planning reuses unchanged inputs and invalidates only actual consumers', async () => {
	await withTempDir('harness-video-', async (root) => {
		await fixture(root);
		const service = new VideoEvidenceService(root);
		const first = service.plan(manifest);
		expect(first.record).toHaveLength(4);
		expect(first.reuse).toEqual([]);
		const previous = first.record.map((slot) => ({ ...slot, testedRevision: 'a'.repeat(40) }));
		const warm = service.plan(manifest, previous);
		expect(warm.record).toEqual([]);
		expect(warm.reuse).toEqual(previous);
		await writeFile(join(root, 'src/first.ts'), 'changed');
		expect(service.plan(manifest, previous).record.map((slot) => slot.clipId)).toEqual([
			'first',
			'first'
		]);
		const reordered = { ...manifest, playlists: [{ id: 'all', clips: ['second', 'first'] }] };
		expect(service.plan(reordered, previous).reuse.map((slot) => slot.clipId)).toEqual([
			'second',
			'second'
		]);
	});
});

test('clip planning follows shared dependencies and rejects missing source bindings', async () => {
	await withTempDir('harness-video-', async (root) => {
		await fixture(root);
		await writeFile(join(root, 'src/shared.css'), 'button { opacity: .8 }');
		await writeFile(
			join(root, 'specification/units/style.shared.json'),
			JSON.stringify({
				id: 'style.shared',
				status: 'active',
				owns: { source: ['src/shared.css'] },
				dependencies: []
			})
		);
		for (const id of ['first', 'second'])
			await writeFile(
				join(root, `specification/units/component.${id}.json`),
				JSON.stringify({
					id: `component.${id}`,
					status: 'active',
					owns: { source: [`src/${id}.ts`] },
					dependencies: [{ unit: 'style.shared' }]
				})
			);
		const service = new VideoEvidenceService(root),
			previous = service.plan(manifest).record;
		await writeFile(join(root, 'src/shared.css'), 'button { opacity: 1 }');
		expect(service.plan(manifest, previous).record).toHaveLength(4);
		expect(() =>
			service.plan({ ...manifest, clips: [{ ...manifest.clips[0], inputs: ['src/missing.ts'] }] })
		).toThrow(/missing/i);
	});
});

test('graph coverage counts only asserted timestamped states and real edges', async () => {
	await measureWorkload('service.video-evidence', 'judge-clip-coverage', () => {
		const graph = {
			id: 'first-page',
			unit: 'component.first',
			initial: 'ready',
			terminals: ['done'],
			states: [
				{ id: 'ready', predicate: 'Start visible' },
				{ id: 'done', predicate: 'Finish visible' }
			],
			edges: [{ id: 'finish', from: 'ready', to: 'done', action: 'Activate finish' }],
			clips: ['first']
		};
		const declared = { ...manifest, graphs: [graph] };
		const service = new VideoEvidenceService();
		const visits = [
			{
				clipId: 'first',
				viewport: 'desktop',
				durationSeconds: 3,
				states: [
					{ id: 'ready', atSeconds: 0.3 },
					{ id: 'done', atSeconds: 2 }
				],
				edges: [{ id: 'finish', atSeconds: 1 }]
			},
			{
				clipId: 'first',
				viewport: 'mobile',
				durationSeconds: 3,
				states: [
					{ id: 'ready', atSeconds: 0.3 },
					{ id: 'done', atSeconds: 2 }
				],
				edges: [{ id: 'finish', atSeconds: 1 }]
			}
		];
		expect(service.coverage(declared, visits)[0]).toMatchObject({
			complete: true,
			states: 1,
			edges: 1
		});
		expect(
			service.coverage(
				declared,
				visits.map((visit) => ({ ...visit, edges: [] }))
			)[0]
		).toMatchObject({ complete: false, edges: 0 });
		expect(
			service.coverage(declared, [{ ...visits[0], states: [{ id: 'done', atSeconds: 9 }] }])[0]
				.complete
		).toBe(false);
	});
});
