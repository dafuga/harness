import type { GameRun, GameView } from '../../../../../game/src/models/game-authoring/Game.types';

/** What decides the line under the AI video control. */
export interface PreviewSummaryInput {
	readonly: boolean;
	transportReady: boolean;
	available: boolean;
	status: 'off' | 'starting' | 'live';
	left: number;
	note: string;
	limit: number;
	rate: number;
}

/** @pure The sentence under the AI video control: why it is off, how it is running or its cost. */
export function previewSummary(input: PreviewSummaryInput): string {
	if (input.readonly) return 'AI video is disabled in this read-only preview.';
	if (!input.transportReady) return 'Live AI is not configured for this build.';
	if (!input.available) return 'AI video needs a saved project open in the desktop app.';
	if (input.status !== 'off')
		return input.status === 'live' ? `Live · ${input.left} s left` : 'Starting the AI video…';
	return (
		input.note || `Runs at most ${input.limit} s, so it costs at most $${input.rate.toFixed(2)}.`
	);
}

/** @pure The arrow keys held as a direction in -1, 0 or 1 on each axis. */
export function arrowDirection(held: { has(key: string): boolean }): { x: number; y: number } {
	return {
		x: Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft')),
		y: Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'))
	};
}

/** @pure Which level and build of a view a run belongs to. */
export function levelKey(view: GameView): string {
	return view.id + ':' + view.planning?.built;
}

/** @pure A run placed at the view's spawn point unless it already belongs to this level and build. */
export function atSpawn(next: GameRun, view: GameView): GameRun {
	if (!view.world || next.state.level === levelKey(view)) return next;
	const { spawn } = view.world;
	const state = { ...next.state, x: spawn.x, y: spawn.z, level: levelKey(view), view: view.id };
	return { ...next, viewId: view.id, state };
}
