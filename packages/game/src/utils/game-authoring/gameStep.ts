import { LevelValidator } from '../../validators/game-authoring/LevelValidator';
import type {
	GameRun,
	GameInput,
	GameView,
	Mechanic
} from '../../models/game-authoring/Game.types';
import { checkpointGraph } from './checkpointGraph';
import { keyDoor } from './keyDoor';

export function createRun(seed = 1, view?: GameView): GameRun {
	const world = view?.world;
	return {
		tick: 0,
		seed: seed >>> 0,
		state: {
			x: 0,
			y: 0,
			hasKey: false,
			doorOpen: false,
			outcome: '',
			choice: '',
			...(world && view
				? {
						x: world.spawn.x,
						y: world.spawn.z,
						level: view.id + ':' + view.planning?.built,
						view: view.id
					}
				: {})
		},
		...(world && view ? { viewId: view.id } : {}),
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
	if (!LevelValidator.isReady(view)) throw new Error('Approve and build the level before playing.');
	if (!Number.isFinite(input.x) || !Number.isFinite(input.y))
		throw new Error('Movement must be finite.');
	run = enterView(run, view.id);
	if (view.world && run.state.level !== view.id + ':' + view.planning?.built)
		run = {
			...run,
			state: {
				...run.state,
				x: view.world.spawn.x,
				y: view.world.spawn.z,
				level: view.id + ':' + view.planning?.built
			}
		};
	const snapshot = Object.freeze({ ...run.state, view: view.id });
	const frozenInput = Object.freeze({ ...input });
	const defaultStep = () =>
		view.world ? levelMovement(snapshot, frozenInput, view.world) : keyDoor(snapshot, frozenInput);
	const state = mechanics ? runMechanics(snapshot, frozenInput, mechanics) : defaultStep();
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

function levelMovement(
	state: GameRun['state'],
	input: GameInput,
	world: NonNullable<GameView['world']>
) {
	const x = Math.max(0.25, Math.min(world.width - 0.25, Number(state.x) + input.x));
	const y = Math.max(0.25, Math.min(world.depth - 0.25, Number(state.y) + input.y));
	const blocked = world.objects.some(
		(o) =>
			o.kind === 'wall' &&
			Math.abs(x - o.x) < o.width / 2 + 0.2 &&
			Math.abs(y - o.z) < o.depth / 2 + 0.2
	);
	return { ...state, ...(blocked ? {} : { x, y }) };
}
