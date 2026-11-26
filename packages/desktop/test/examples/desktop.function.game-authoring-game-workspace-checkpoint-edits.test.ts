import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	replaceCheckpoint,
	withoutCheckpoint,
	isRevisionConflict
} from '../../src/components/game-authoring/game-workspace/checkpointEdits';
import type { Checkpoint } from './desktop.function.game-authoring-game-workspace-checkpoint-edits.test.types';

const KEY: Checkpoint = {
	id: 'key',
	title: 'Collect the key',
	description: 'When the player reaches the key, add it to inventory.',
	x: 0,
	y: 80,
	requires: [],
	conditions: [{ field: 'x', op: 'gte', value: 2 }],
	actions: [
		{ type: 'set', target: 'hasKey', value: true },
		{ type: 'emit', target: 'key-collected', value: true }
	]
};

const DOOR: Checkpoint = {
	id: 'door',
	title: 'Unlock the door',
	description: 'The key unlocks the door. Reveal two possible destinations.',
	x: 270,
	y: 80,
	requires: ['key'],
	conditions: [
		{ field: 'x', op: 'gte', value: 4 },
		{ field: 'hasKey', op: 'eq', value: true }
	],
	actions: [{ type: 'set', target: 'doorOpen', value: true }]
};

const GARDEN: Checkpoint = {
	id: 'garden',
	title: 'Enter the garden',
	description: 'Choosing the garden ends the journey in the sunlight.',
	x: 540,
	y: 0,
	requires: ['door'],
	conditions: [
		{ field: 'choice', op: 'eq', value: 'garden' },
		{ field: 'outcome', op: 'eq', value: '' }
	],
	actions: [{ type: 'set', target: 'outcome', value: 'garden' }]
};

const NORTH_DOOR: Checkpoint = { ...DOOR, title: 'Unlock the north door' };

const CHECKPOINTS: Checkpoint[] = [KEY, DOOR, GARDEN];

function summarise(checkpoints: Checkpoint[]) {
	return checkpoints.map((item) => ({ id: item.id, title: item.title, requires: item.requires }));
}

test('Replaces the door checkpoint and keeps the others in order', () => {
	const replaced = replaceCheckpoint(CHECKPOINTS, 'door', NORTH_DOOR);
	const unchangedId = replaceCheckpoint(CHECKPOINTS, null, NORTH_DOOR);
	const empty = replaceCheckpoint([], 'door', NORTH_DOOR);

	expect(replaced.map((item) => item.id)).toEqual(['key', 'door', 'garden']);
	expect(replaced[1]).toBe(NORTH_DOOR);
	expect(replaced[0]).toBe(KEY);
	expect(replaced[2]).toBe(GARDEN);
	expect(CHECKPOINTS[1].title).toBe('Unlock the door');
	expect(summarise(unchangedId)).toEqual(summarise(CHECKPOINTS));
	expect(empty).toEqual([]);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-workspace-checkpoint-edits',
			symbol: 'replaceCheckpoint',
			state: 'replaces-the-door-checkpoint-and-keeps-the-others-in-order',
			evidence: 'examples-cases',
			file: 'replaces-the-door-checkpoint-and-keeps-the-others-in-order.json'
		},
		[
			{
				name: 'replace the door with a node titled north door',
				input: { id: 'door', node: NORTH_DOOR.title },
				output: summarise(replaced)
			},
			{
				name: 'a null id matches no checkpoint',
				input: { id: null },
				output: summarise(unchangedId)
			},
			{ name: 'an empty list stays empty', input: { checkpoints: [] }, output: empty }
		]
	);
});

test('Removes a checkpoint and its requirement from the others', () => {
	const remaining = withoutCheckpoint(CHECKPOINTS, 'door');
	const missing = withoutCheckpoint(CHECKPOINTS, 'missing');
	const empty = withoutCheckpoint([], 'door');

	expect(remaining.map((item) => item.id)).toEqual(['key', 'garden']);
	expect(remaining[1].requires).toEqual([]);
	expect(remaining[0]).not.toBe(KEY);
	expect(CHECKPOINTS[2].requires).toEqual(['door']);
	expect(missing.map((item) => item.id)).toEqual(['key', 'door', 'garden']);
	expect(empty).toEqual([]);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-workspace-checkpoint-edits',
			symbol: 'withoutCheckpoint',
			state: 'removes-a-checkpoint-and-its-requirement-from-the-others',
			evidence: 'examples-cases',
			file: 'removes-a-checkpoint-and-its-requirement-from-the-others.json'
		},
		[
			{ name: 'remove the door', input: { id: 'door' }, output: summarise(remaining) },
			{ name: 'remove an unknown id', input: { id: 'missing' }, output: summarise(missing) },
			{ name: 'an empty list stays empty', input: { checkpoints: [] }, output: empty }
		]
	);
});

test('Recognises a save failure that says the revision moved on', () => {
	const messages = [
		'The game changed. Reload before saving.',
		'Stored revision is stale.',
		'Save conflict detected.',
		'Changes saved.',
		'Game document exceeds 1MB.',
		'game.json must be a regular file.'
	];
	const results = messages.map((message) => isRevisionConflict(message));

	expect(results).toEqual([true, true, true, false, false, false]);
	expect(isRevisionConflict('UNCHANGED')).toBe(true);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-workspace-checkpoint-edits',
			symbol: 'isRevisionConflict',
			state: 'recognises-a-save-failure-that-says-the-revision-moved-on',
			evidence: 'examples-cases',
			file: 'recognises-a-save-failure-that-says-the-revision-moved-on.json'
		},
		messages.map((message, index) => ({
			name: `conflict check for message ${index + 1}`,
			input: message,
			output: results[index]
		}))
	);
});
