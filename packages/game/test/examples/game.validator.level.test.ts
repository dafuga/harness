import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { LevelValidator } from '../../src/validators/game-authoring/LevelValidator';
import type { GameView, LevelLayout, LevelPlanning } from '../../src/models/game-authoring/Game.types';

const layout: LevelLayout = {
	width: 12,
	depth: 10,
	spawn: { x: 1, z: 1 },
	objects: [
		{ id: 'goal-east', kind: 'goal', label: 'Exit', x: 10, z: 8, width: 1, depth: 1, height: 1 }
	]
};
const id = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const planning: LevelPlanning = {
	concept: 'A short platforming course',
	description: 'Cross the yard and reach the goal.',
	proposal: {
		id,
		concept: 'A short platforming course',
		description: 'Cross the yard and reach the goal.',
		dimension: '3d',
		provider: 'codex',
		model: 'gpt-6-luna',
		summary: 'A compact route across a training yard.',
		layout
	}
};
function view(): GameView {
	return {
		id: 'view-training-yard', title: 'Training Yard', dimension: '3d' as const,
		style: 'blockout', checkpoints: [], planning, world: layout
	};
}

test('Accepts bounded layouts and rejects wall overlap', () => {
	const blocked = { ...layout, objects: [{ id: 'wall-north', kind: 'wall', label: 'Wall', x: 1, z: 1, width: 1, depth: 1, height: 2 }] };
	const accepted = LevelValidator.layout(layout);
	const rejected = LevelValidator.layout(blocked);
	expect(accepted).toBe(true);
	expect(rejected).toBe(false);
	recordExampleCases({ unitId: 'game.validator.level', symbol: 'layout', state: 'accepts-bounded-layouts-and-rejects-wall-overlap', evidence: 'examples-cases', file: 'accepts-bounded-layouts-and-rejects-wall-overlap.json' }, [
		{ name: 'valid goal layout', input: layout, output: accepted },
		{ name: 'wall overlaps spawn', input: blocked, output: rejected }
	]);
});

test('Accepts a valid plan and rejects an invalid approval hash', () => {
	const invalid = { ...planning, approved: 'not-a-hash' };
	const accepted = LevelValidator.planning(planning);
	const rejected = LevelValidator.planning(invalid);
	expect(accepted).toBe(true);
	expect(rejected).toBe(false);
	recordExampleCases({ unitId: 'game.validator.level', symbol: 'planning', state: 'accepts-a-valid-plan-and-rejects-an-invalid-approval-hash', evidence: 'examples-cases', file: 'accepts-a-valid-plan-and-rejects-an-invalid-approval-hash.json' }, [
		{ name: 'valid proposal', input: planning, output: accepted },
		{ name: 'malformed approval hash', input: invalid, output: rejected }
	]);
});

test('Recognizes a current proposal and a stale brief', () => {
	const current = view();
	const stale = { ...current, planning: { ...planning, concept: 'Different course' } };
	const currentResult = LevelValidator.isCurrent(current);
	const staleResult = LevelValidator.isCurrent(stale);
	expect(currentResult).toBe(true);
	expect(staleResult).toBe(false);
	recordExampleCases({ unitId: 'game.validator.level', symbol: 'isCurrent', state: 'recognizes-a-current-proposal-and-a-stale-brief', evidence: 'examples-cases', file: 'recognizes-a-current-proposal-and-a-stale-brief.json' }, [
		{ name: 'proposal matches brief and dimension', input: current, output: currentResult },
		{ name: 'brief changed after proposal', input: stale, output: staleResult }
	]);
});

test('Requires matching approval build and world before readiness', () => {
	const ready = { ...view(), planning: { ...planning, approved: id, built: id } };
	const pending = { ...view(), planning: { ...planning, approved: id } };
	const readyResult = LevelValidator.isReady(ready);
	const pendingResult = LevelValidator.isReady(pending);
	expect(readyResult).toBe(true);
	expect(pendingResult).toBe(false);
	recordExampleCases({ unitId: 'game.validator.level', symbol: 'isReady', state: 'requires-matching-approval-build-and-world-before-readiness', evidence: 'examples-cases', file: 'requires-matching-approval-build-and-world-before-readiness.json' }, [
		{ name: 'approved and built layout matches world', input: ready, output: readyResult },
		{ name: 'build approval is missing', input: pending, output: pendingResult }
	]);
});
