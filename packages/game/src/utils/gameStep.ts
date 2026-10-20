import type { GameRun, GameInput, GameView, Mechanic } from '../models/Game.types';
import { checkpointGraph } from './checkpointGraph';
import { keyDoor } from './keyDoor';

export function createRun(seed = 1): GameRun {
	return {
		tick: 0,
		seed: seed >>> 0,
		state: { x: 0, y: 0, hasKey: false, doorOpen: false, outcome: '', choice: '' },
		completed: [],
		events: [],
		trace: []
	};
}

/** One 1/60 second tick. Mechanics share a snapshot; duplicate writes are refused. */
export function stepGame(
	run: GameRun,
	input: GameInput,
	view: GameView,
	mechanics?: Mechanic[]
): GameRun {
	if (!Number.isFinite(input.x) || !Number.isFinite(input.y))
		throw new Error('Movement must be finite.');
	run = enterView(run, view.id);
	const snapshot = Object.freeze({ ...run.state, view: view.id });
	const frozenInput = Object.freeze({ ...input });
	const state = mechanics
		? runMechanics(snapshot, frozenInput, mechanics)
		: keyDoor(snapshot, frozenInput);
	return checkpointGraph({ ...run, state, tick: run.tick + 1, seed: nextSeed(run.seed) }, view);
}

function runMechanics(state: GameRun['state'], input: GameInput, mechanics: Mechanic[]) {
	const result = { ...state };
	const written = new Set<string>();
	for (const mechanic of [...mechanics].sort((a, b) => a.id.localeCompare(b.id))) {
		const patch = mechanic.step(state, input);
		for (const [key, value] of Object.entries(patch)) {
			if (written.has(key)) throw new Error('Conflicting mechanic write: ' + key);
			if (['__proto__', 'constructor', 'prototype'].includes(key))
				throw new Error('Unsafe state field.');
			written.add(key);
			result[key] = value;
		}
	}
	return result;
}

function nextSeed(seed: number): number {
	let value = seed || 1;
	value ^= value << 13;
	value ^= value >>> 17;
	value ^= value << 5;
	return value >>> 0;
}

export const gameStep = stepGame;

export function enterView(run: GameRun, id: string): GameRun {
	const previous = run.viewId ?? id;
	const progress = { ...run.progress, [previous]: run.completed };
	return {
		...run,
		state: { ...run.state, view: id },
		viewId: id,
		progress,
		completed: previous === id ? run.completed : (progress[id] ?? [])
	};
}
