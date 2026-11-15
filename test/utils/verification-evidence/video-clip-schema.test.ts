import { expect, test } from 'vitest';
import { videoClipSchema } from '../../../src/utils/verification-evidence/videoClipSchema';

const manifest = {
	schemaVersion: 1,
	viewports: [{ id: 'desktop', width: 920, height: 700 }],
	clips: [
		{
			id: 'open',
			unit: 'component.menu',
			state: 'open',
			viewports: ['desktop'],
			inputs: ['src/menu.ts'],
			script: { path: 'test/menu.spec.ts', export: 'openMenu' },
			fixture: 'test/menu.json',
			entry: 'closed',
			exit: 'open',
			states: ['closed', 'open'],
			edges: ['open-menu'],
			durationSeconds: 3
		}
	],
	graphs: [
		{
			id: 'menu',
			unit: 'component.menu',
			initial: 'closed',
			terminals: ['open'],
			states: [
				{ id: 'closed', predicate: 'Menu is hidden' },
				{ id: 'open', predicate: 'Menu is visible' }
			],
			edges: [{ id: 'open-menu', from: 'closed', to: 'open', action: 'Click menu trigger' }],
			clips: ['open']
		}
	],
	playlists: [{ id: 'happy-path', clips: ['open'] }]
};

test('versioned video contracts retain modular scripts and graph bindings', () => {
	expect(videoClipSchema(manifest)).toEqual(manifest);
});

test('video contracts reject unknown versions, unsafe bindings and oversized segments', () => {
	for (const change of [
		{ schemaVersion: 2 },
		{ clips: [{ ...manifest.clips[0], durationSeconds: 16 }] },
		{ clips: [{ ...manifest.clips[0], inputs: ['../private'] }] },
		{ clips: [{ ...manifest.clips[0], script: { path: '/tmp/script.ts', export: 'run' } }] },
		{ clips: [{ ...manifest.clips[0], viewports: ['missing'] }] },
		{ clips: [manifest.clips[0], manifest.clips[0]] },
		{ playlists: [{ id: 'broken', clips: ['missing'] }] }
	])
		expect(() => videoClipSchema({ ...manifest, ...change })).toThrow();
});

test('page graphs reject unreachable states, unknown edges and incompatible clip checkpoints', () => {
	const graph = manifest.graphs[0];
	for (const change of [
		{ states: [...graph.states, { id: 'lost', predicate: 'Unreachable panel' }] },
		{ edges: [{ ...graph.edges[0], to: 'missing' }] },
		{ clips: ['missing'] }
	])
		expect(() => videoClipSchema({ ...manifest, graphs: [{ ...graph, ...change }] })).toThrow();
	expect(() =>
		videoClipSchema({ ...manifest, clips: [{ ...manifest.clips[0], exit: 'missing' }] })
	).toThrow();
});
