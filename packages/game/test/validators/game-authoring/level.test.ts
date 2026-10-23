import { expect, test } from 'vitest';
import { LevelValidator } from '../../../src/validators/game-authoring/LevelValidator';
import { exampleDocument } from '../../../src/utils/game-authoring/keyDoor';
import { stepGame, createRun } from '../../../src/utils/game-authoring/gameStep';
import type { LevelLayout, LevelPlanning } from '../../../src/models/game-authoring/Game.types';
const layout: LevelLayout = {
	width: 12,
	depth: 8,
	spawn: { x: 1, z: 1 },
	objects: [{ id: 'wall', kind: 'wall', label: 'Wall', x: 5, z: 4, width: 1, depth: 3, height: 2 }]
};
test('level geometry rejects unsafe, overlapping and oversized layouts', () => {
	expect(LevelValidator.layout(layout)).toBe(true);
	expect(LevelValidator.layout({ ...layout, width: Infinity })).toBe(false);
	expect(LevelValidator.layout({ ...layout, spawn: { x: 5, z: 4 } })).toBe(false);
	expect(
		LevelValidator.layout({ ...layout, objects: [...layout.objects, ...layout.objects] })
	).toBe(false);
	expect(LevelValidator.layout({ ...layout, objects: [{ ...layout.objects[0], x: 0 }] })).toBe(
		false
	);
});
test('approval and build belong to the exact brief and generated geometry', () => {
	const view = exampleDocument().views[0],
		id = 'a'.repeat(64);
	const planning: LevelPlanning = {
		concept: 'Island',
		description: 'Reach the lantern',
		proposal: {
			id,
			concept: 'Island',
			description: 'Reach the lantern',
			dimension: '2d',
			provider: 'codex',
			model: 'fixture',
			summary: 'Island',
			layout
		}
	};
	Object.assign(view, { planning });
	expect(LevelValidator.isReady(view)).toBe(false);
	planning.approved = id;
	expect(LevelValidator.isReady(view)).toBe(false);
	planning.built = id;
	view.world = globalThis.structuredClone(layout);
	expect(LevelValidator.isReady(view)).toBe(true);
	expect(createRun(1, view).state).toMatchObject({ x: 1, y: 1, level: view.id + ':' + id });
	const run = stepGame(createRun(), { x: 1, y: 0 }, view);
	expect(run.state.x).toBe(2);
	expect(run.state.y).toBe(1);
	planning.description = 'Changed';
	expect(LevelValidator.isReady(view)).toBe(false);
	expect(() => stepGame(run, { x: 1, y: 0 }, view)).toThrow('Approve and build');
});
