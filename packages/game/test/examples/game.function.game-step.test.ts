import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	GameStepRefusedError,
	createRun,
	stepGame,
	gameStep,
	enterView
} from '../../src/utils/game-authoring/gameStep';

const forest = {
	id: 'game.view.forest',
	title: 'Forest',
	dimension: '3d' as const,
	style: 'low-poly',
	checkpoints: []
};

function runSummary(run: ReturnType<typeof createRun>) {
	return {
		tick: run.tick,
		seed: run.seed,
		state: run.state,
		viewId: run.viewId,
		progress: run.progress,
		completed: run.completed
	};
}

test('Creates a seeded run at the supplied view spawn', () => {
	const cave = {
		...forest,
		id: 'game.view.cave',
		planning: { concept: 'Short cave route', description: 'A small cave.', built: 'build-cave-v1' },
		world: { width: 12, depth: 8, spawn: { x: 2, z: 3 }, objects: [] }
	};
	const defaults = createRun();
	const atCave = createRun(42, cave);
	expect(runSummary(atCave)).toMatchObject({ tick: 0, seed: 42, viewId: 'game.view.cave' });
	recordExampleCases(
		{
			unitId: 'game.function.game-step',
			symbol: 'createRun',
			state: 'creates-a-seeded-run-at-the-supplied-view-spawn',
			evidence: 'examples-cases',
			file: 'creates-a-seeded-run-at-the-supplied-view-spawn.json'
		},
		[
			{ name: 'default seed without a view', input: {}, output: runSummary(defaults) },
			{ name: 'seed and cave spawn', input: { seed: 42, view: cave }, output: runSummary(atCave) }
		]
	);
});

test('Advances a tick through sorted mechanics', () => {
	const initial = createRun();
	const input = { x: 1, y: -0.5, interact: false, choice: 'left' };
	const stepped = gameStep(initial, input, forest, [
		{ id: 'second', step: () => ({ outcome: 'arrived' }) },
		{ id: 'first', step: () => ({ choice: 'left' }) }
	]);
	expect(runSummary(stepped)).toMatchObject({ tick: 1, seed: 270369, viewId: forest.id });
	recordExampleCases(
		{
			unitId: 'game.function.game-step',
			symbol: 'gameStep',
			state: 'advances-a-tick-through-sorted-mechanics',
			evidence: 'examples-cases',
			file: 'advances-a-tick-through-sorted-mechanics.json'
		},
		[
			{
				name: 'mechanics update separate state fields on one tick',
				input: { run: initial, input, view: forest, mechanics: ['first', 'second'] },
				output: runSummary(stepped)
			}
		]
	);
});

test('Restores completion when entering a view', () => {
	const run = {
		...createRun(),
		viewId: 'game.view.forest',
		completed: ['checkpoint-1'],
		progress: { 'game.view.cave': ['cave-entry'] }
	};
	const entered = enterView(run, 'game.view.cave');
	expect(runSummary(entered)).toMatchObject({
		viewId: 'game.view.cave',
		completed: ['cave-entry'],
		progress: { 'game.view.forest': ['checkpoint-1'] }
	});
	recordExampleCases(
		{
			unitId: 'game.function.game-step',
			symbol: 'enterView',
			state: 'restores-completion-when-entering-a-view',
			evidence: 'examples-cases',
			file: 'restores-completion-when-entering-a-view.json'
		},
		[
			{
				name: 'save forest progress and restore cave checkpoint',
				input: { run, id: 'game.view.cave' },
				output: runSummary(entered)
			}
		]
	);
});

test('Refuses non-finite movement and conflicting mechanic writes', () => {
	const run = createRun();
	const rejected: string[] = [];
	try {
		stepGame(run, { x: Number.NaN, y: 0 }, forest);
	} catch (error) {
		if (error instanceof GameStepRefusedError) rejected.push(error.message);
	}
	try {
		stepGame(run, { x: 0, y: 0 }, forest, [
			{ id: 'first', step: () => ({ choice: 'left' }) },
			{ id: 'second', step: () => ({ choice: 'right' }) }
		]);
	} catch (error) {
		if (error instanceof GameStepRefusedError) rejected.push(error.message);
	}
	expect(rejected).toEqual([
		'Movement must be finite.',
		'Conflicting mechanic write: choice'
	]);
	recordExampleCases(
		{
			unitId: 'game.function.game-step',
			symbol: 'stepGame',
			state: 'refuses-non-finite-movement-and-conflicting-mechanic-writes',
			evidence: 'examples-cases',
			file: 'refuses-non-finite-movement-and-conflicting-mechanic-writes.json'
		},
		[
			{
				name: 'NaN movement delta is refused',
				input: { run, input: { x: 'NaN', y: 0 }, view: forest },
				error: 'GameStepRefusedError: Movement must be finite.'
			},
			{
				name: 'mechanics cannot write the same state field',
				input: { run, input: { x: 0, y: 0 }, view: forest, writes: ['choice', 'choice'] },
				error: 'GameStepRefusedError: Conflicting mechanic write: choice'
			}
		]
	);
});
