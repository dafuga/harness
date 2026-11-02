import { expect, test } from 'vitest';
import type { GameRun, GameView } from '../../game/src/models/game-authoring/Game.types';
import {
	arrowDirection,
	atSpawn,
	levelKey,
	previewSummary
} from '../src/components/game-authoring/game-preview/gamePreviewReading';

const base = {
	readonly: false,
	transportReady: true,
	available: true,
	status: 'off' as const,
	left: 12,
	note: '',
	limit: 60,
	rate: 0.6
};

test('the summary gives the first reason the video cannot run, then its state or cost', () => {
	expect(previewSummary({ ...base, readonly: true })).toContain('read-only');
	expect(previewSummary({ ...base, transportReady: false })).toContain('not configured');
	expect(previewSummary({ ...base, available: false })).toContain('saved project');
	expect(previewSummary({ ...base, status: 'starting' })).toBe('Starting the AI video…');
	expect(previewSummary({ ...base, status: 'live' })).toBe('Live · 12 s left');
	expect(previewSummary({ ...base, note: 'Stopped.' })).toBe('Stopped.');
	expect(previewSummary(base)).toBe('Runs at most 60 s, so it costs at most $0.60.');
});

test('held arrow keys give a direction on each axis, opposite keys cancelling', () => {
	const held = (...keys: string[]) => new Set(keys);
	expect(arrowDirection(held())).toEqual({ x: 0, y: 0 });
	expect(arrowDirection(held('ArrowRight', 'ArrowUp'))).toEqual({ x: 1, y: -1 });
	expect(arrowDirection(held('ArrowLeft', 'ArrowRight', 'ArrowDown'))).toEqual({ x: 0, y: 1 });
});

test('a run is moved to the spawn only when it belongs to another level or build', () => {
	const view = {
		id: 'a',
		planning: { built: 'b1' },
		world: { spawn: { x: 3, z: 4 } }
	} as unknown as GameView;
	expect(levelKey(view)).toBe('a:b1');
	const fresh = { state: { level: 'other', x: 0, y: 0, view: 'z' } } as unknown as GameRun;
	const moved = atSpawn(fresh, view);
	expect(moved.state).toMatchObject({ x: 3, y: 4, level: 'a:b1', view: 'a' });
	expect(atSpawn(moved, view)).toBe(moved);
	expect(atSpawn(fresh, { ...view, world: undefined })).toBe(fresh);
});
