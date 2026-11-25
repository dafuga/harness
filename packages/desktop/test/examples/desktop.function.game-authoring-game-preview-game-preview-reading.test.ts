import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	arrowDirection,
	levelKey,
	atSpawn
} from '../../src/components/game-authoring/game-preview/gamePreviewReading';
import type { PreviewSummaryInput } from '../../src/components/game-authoring/game-preview/gamePreviewReading';
import type {
	View,
	Run
} from './desktop.function.game-authoring-game-preview-game-preview-reading.test.types';
import { summary } from './desktop.function.game-authoring-game-preview-game-preview-reading.cases';

function view(id: string, built?: number, world = true): View {
	return {
		id,
		title: id,
		dimension: '2d',
		style: 'pixel',
		checkpoints: [],
		planning: built === undefined ? undefined : { built },
		world: world ? { spawn: { x: 4, z: 7 } } : undefined
	} as unknown as View;
}

function run(level: string): Run {
	return {
		tick: 0,
		seed: 7,
		state: { x: 1, y: 2, level, view: 'old' },
		completed: [],
		events: [],
		trace: []
	} as unknown as Run;
}

function placed(next: Run): Record<string, unknown> {
	const state = next.state as unknown as Record<string, unknown>;
	return { viewId: next.viewId, x: state.x, y: state.y, level: state.level, view: state.view };
}

test('shows live, starting or idle AI video status', () => {
	const inputs: Partial<PreviewSummaryInput>[] = [
		{ status: 'live', left: 42 },
		{ status: 'starting' },
		{ note: 'Ask for a short clip.' },
		{}
	];
	const outputs = inputs.map(summary);

	expect(outputs).toEqual([
		'Live · 42 s left',
		'Starting the AI video…',
		'Ask for a short clip.',
		'Runs at most 120 s, so it costs at most $0.50.'
	]);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'previewSummary',
			state: 'shows-live-starting-or-idle-ai-video-status',
			evidence: 'examples-cases',
			file: 'shows-live-starting-or-idle-ai-video-status.json'
		},
		[
			{ name: 'live with seconds left', input: inputs[0], output: outputs[0] },
			{ name: 'starting', input: inputs[1], output: outputs[1] },
			{ name: 'idle with a note', input: inputs[2], output: outputs[2] },
			{ name: 'idle without a note shows the cost', input: inputs[3], output: outputs[3] }
		]
	);
});

test('reads held arrow keys as a direction', () => {
	const holds = [
		['ArrowLeft', 'ArrowUp'],
		['ArrowRight', 'ArrowDown'],
		['ArrowLeft', 'ArrowRight'],
		['Space']
	];
	const outputs = holds.map((keys) => arrowDirection(new Set(keys)));

	expect(outputs).toEqual([
		{ x: -1, y: -1 },
		{ x: 1, y: 1 },
		{ x: 0, y: 0 },
		{ x: 0, y: 0 }
	]);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'arrowDirection',
			state: 'reads-held-arrow-keys-as-a-direction',
			evidence: 'examples-cases',
			file: 'reads-held-arrow-keys-as-a-direction.json'
		},
		[
			{ name: 'left and up held', input: holds[0], output: outputs[0] },
			{ name: 'right and down held', input: holds[1], output: outputs[1] },
			{ name: 'opposite keys cancel', input: holds[2], output: outputs[2] },
			{ name: 'non-arrow key is ignored', input: holds[3], output: outputs[3] }
		]
	);
});

test('keys a level by its view id and build', () => {
	const inputs = [view('forest', 3), view('cave')];
	const outputs = inputs.map(levelKey);

	expect(outputs).toEqual(['forest:3', 'cave:undefined']);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'levelKey',
			state: 'keys-a-level-by-its-view-id-and-build',
			evidence: 'examples-cases',
			file: 'keys-a-level-by-its-view-id-and-build.json'
		},
		[
			{ name: 'view with planning build 3', input: inputs[0], output: outputs[0] },
			{ name: 'view without planning', input: inputs[1], output: outputs[1] }
		]
	);
});

test('places a run at the spawn point of its level', () => {
	const next = run('old');
	const out = atSpawn(next, view('forest', 3));

	expect(placed(out)).toEqual({ viewId: 'forest', x: 4, y: 7, level: 'forest:3', view: 'forest' });
	expect(placed(next)).toMatchObject({ x: 1, y: 2, level: 'old' });

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'atSpawn',
			state: 'places-a-run-at-the-spawn-point-of-its-level',
			evidence: 'examples-cases',
			file: 'places-a-run-at-the-spawn-point-of-its-level.json'
		},
		[
			{
				name: 'run from another level moves to spawn',
				input: { level: 'old', view: 'forest:3' },
				output: placed(out)
			}
		]
	);
});

test('keeps a run already on its level or with no world', () => {
	const same = run('forest:3');
	const noWorld = run('old');
	const sameOut = atSpawn(same, view('forest', 3));
	const noWorldOut = atSpawn(noWorld, view('forest', 3, false));

	expect(sameOut).toBe(same);
	expect(noWorldOut).toBe(noWorld);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'atSpawn',
			state: 'keeps-a-run-already-on-its-level-or-with-no-world',
			evidence: 'examples-cases',
			file: 'keeps-a-run-already-on-its-level-or-with-no-world.json'
		},
		[
			{ name: 'run already on this level and build', input: 'forest:3', output: placed(sameOut) },
			{ name: 'view without a world', input: 'old', output: placed(noWorldOut) }
		]
	);
});
