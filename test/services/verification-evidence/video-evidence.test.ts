import { afterEach, expect, test, vi } from 'vitest';
import * as files from 'node:fs';
import * as processes from 'node:child_process';
import { VideoEvidenceService } from '../../../src/services/verification-evidence/VideoEvidenceService';
import type { VideoObservation } from '../../../src/services/verification-evidence/VideoEvidenceService.types';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import { assertTrackedVideoInputs } from '../../support/videoTrackedInputs';
import { assertVideoCheckpoints } from '../../support/videoCheckpointAssertions';
const videoUnit = 'service.verification-evidence-video-evidence';
afterEach(() => vi.restoreAllMocks());
vi.mock('node:fs', { spy: true });
vi.mock('node:child_process', { spy: true });
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
	assertVideoCheckpoints(manifest);
});
test('clip planning reuses unchanged inputs and invalidates only actual consumers', async () => {
	await measureWorkload(videoUnit, 'plan-input-closure', () =>
		withTempDir('harness-video-', async (root) => {
			await fixture(root);
			const service = new VideoEvidenceService(root);
			await writeFile(join(root, 'src/first.ts'), "import './private.ts';");
			await writeFile(join(root, 'src/private.ts'), 'export const answer = 1;');
			const reads = vi.spyOn(files, 'readFileSync'),
				tools = vi.spyOn(processes, 'spawnSync');
			const first = service.plan(manifest);
			expect(first.record).toHaveLength(4);
			expect(first.reuse).toEqual([]);
			expect(tools.mock.calls.filter(([command]) => command === 'ffmpeg')).toHaveLength(1);
			const inputReads = reads.mock.calls.map(([path]) => String(path));
			expect(inputReads.filter((path) => path.includes('specification/units/'))).toHaveLength(2);
			expect(new Set(inputReads).size).toBe(inputReads.length);
			const previous = first.record.map((slot) => ({ ...slot, testedRevision: 'a'.repeat(40) }));
			await writeFile(join(root, 'src/unrelated.ts'), 'unrelated change');
			const warm = service.plan(manifest, previous);
			expect(warm.record).toEqual([]);
			expect(warm.reuse).toEqual(previous);
			expect(warm.reuse[0]).toBe(previous[0]);
			await writeFile(join(root, 'src/private.ts'), 'export const answer = 2;');
			expect(service.plan(manifest, previous).record.map((slot) => slot.clipId)).toEqual([
				'first',
				'first'
			]);
			const reordered = { ...manifest, playlists: [{ id: 'all', clips: ['second', 'first'] }] };
			expect(service.plan(reordered, previous).reuse.map((slot) => slot.clipId)).toEqual([
				'second',
				'second'
			]);
			await writeFile(join(root, 'src/private.ts'), 'export const answer = 1;');
			await writeFile(join(root, 'src/second.ts'), 'changed independent source');
			expect(service.plan(manifest, previous).record.map((slot) => slot.clipId)).toEqual([
				'second',
				'second'
			]);
			await writeFile(join(root, 'src/first.ts'), 'import(target);');
			const uncertain = service.plan(manifest).record;
			expect(uncertain[0]).toMatchObject({
				reasons: [expect.stringMatching(/dynamic|non-literal/)]
			});
			await writeFile(join(root, 'src/unrelated.ts'), 'changed dynamic candidate');
			expect(service.plan(manifest, uncertain).record.map((slot) => slot.clipId)).toEqual([
				'first',
				'first'
			]);
			await assertTrackedVideoInputs(root, manifest);
		})
	);
});
test('clip planning follows shared dependencies and rejects missing source bindings', async () => {
	await withTempDir('harness-video-', async (root) => {
		await fixture(root);
		await mkdir(join(root, 'static'));
		await mkdir(join(root, 'src/routes/demo'), { recursive: true });
		await writeFile(join(root, 'static/font.woff2'), 'font version one');
		await writeFile(join(root, 'src/shared.css'), "@font-face { src: url('/font.woff2') }");
		await writeFile(join(root, 'src/first.ts'), "import './routes/demo/+page.svelte';");
		await writeFile(join(root, 'src/routes/demo/+page.svelte'), '<p>Page</p>');
		await writeFile(join(root, 'src/routes/+layout.svelte'), '<main>Layout</main>');
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
		await writeFile(join(root, 'static/font.woff2'), 'font version two');
		expect(service.plan(manifest, previous).record).toHaveLength(4);
		await writeFile(join(root, 'static/font.woff2'), 'font version one');
		await writeFile(join(root, 'src/routes/+layout.svelte'), '<main>Changed parent</main>');
		expect(service.plan(manifest, previous).record.map((slot) => slot.clipId)).toEqual([
			'first',
			'first'
		]);
		await writeFile(join(root, 'src/first.ts'), "import './missing.ts';");
		expect(() => service.plan(manifest)).toThrow(/missing|unresolved/i);
		await symlink('/etc/hosts', join(root, 'src/escape.ts'));
		await writeFile(join(root, 'src/first.ts'), "import './escape.ts';");
		expect(() => service.plan(manifest)).toThrow(/escapes/i);
		expect(() =>
			service.plan({
				...manifest,
				clips: manifest.clips.map((clip, index) =>
					index === 0 ? { ...clip, inputs: ['src/missing.ts'] } : clip
				)
			})
		).toThrow(/missing/i);
	});
});
test('graph coverage counts only asserted timestamped states and real edges', async () => {
	await measureWorkload(videoUnit, 'judge-clip-coverage', () => {
		const graph = {
			id: 'first-page',
			unit: 'component.first',
			initial: 'ready',
			terminals: ['done'],
			states: ['ready', 'done'].map((id) => ({ id, predicate: `${id} visible` })),
			edges: [{ id: 'finish', from: 'ready', to: 'done', action: 'Activate finish' }],
			clips: ['first']
		};
		const declared = { ...manifest, graphs: [graph] };
		const service = new VideoEvidenceService();
		const assess = (observations: VideoObservation[]) =>
			service.coverage(declared, observations)[0];
		const visits = ['desktop', 'mobile'].map((viewport) => ({
			clipId: 'first',
			viewport,
			durationSeconds: 3,
			fresh: true,
			states: [
				{ id: 'ready', atSeconds: 0.3 },
				{ id: 'done', atSeconds: 2 }
			],
			edges: [{ id: 'finish', atSeconds: 1 }]
		}));
		expect(assess(visits)).toMatchObject({
			complete: true,
			states: 1,
			edges: 1
		});
		expect(assess(visits.map((visit) => ({ ...visit, fresh: undefined }))).complete).toBe(false);
		expect(assess(visits.map((visit) => ({ ...visit, edges: [] })))).toMatchObject({
			complete: false,
			edges: 0
		});
		expect(assess([{ ...visits[0], states: [{ id: 'done', atSeconds: 9 }] }]).complete).toBe(false);
		const siblings = {
			...declared,
			clips: declared.clips.map((clip) => ({ ...clip, unit: graph.unit })),
			graphs: [{ ...graph, clips: ['first', 'second'] }]
		};
		const partial = visits.map((visit) => ({ ...visit, states: [visit.states[0]], edges: [] }));
		const combined = service.coverage(siblings, [
			...partial,
			...visits.map((visit) => ({ ...visit, clipId: 'second' }))
		])[0];
		expect(combined).toMatchObject({ complete: false, states: 1, edges: 1, clips: 0.5 });
		expect(combined.missing).toEqual(['desktop/clip/first', 'mobile/clip/first']);
	});
});
