import type { CaseRow } from './game.function.key-door.test.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { keyDoor, exampleDocument } from '../../src/utils/game-authoring/keyDoor';

const start = { x: 0, y: 0, hasKey: false, doorOpen: false, choice: '', outcome: '' };
const behind = { ...start, x: 2.5, y: -1.25 };
const withKey = { ...behind, hasKey: true };

function record(state: string, symbol: string, cases: CaseRow[]): void {
	recordExampleCases(
		{
			unitId: 'game.function.key-door',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function summarise(doc: ReturnType<typeof exampleDocument>) {
	return {
		version: doc.version,
		dimension: doc.views[0].dimension,
		checkpoints: doc.views[0].checkpoints.map((checkpoint) => checkpoint.id)
	};
}

test('Keeps the player behind the door until the key is held', () => {
	const moveInput = { x: 3, y: 0 };
	const closed = keyDoor(behind, moveInput);
	const fromStart = keyDoor(start, { x: 1, y: 0 });
	expect(closed.x).toBe(3);
	expect(closed.y).toBe(-1.25);
	expect(fromStart.x).toBe(1);
	record('keeps-the-player-behind-the-door-until-the-key-is-held', 'keyDoor', [
		{ name: 'no key and door shut: x stops at 3', input: { state: behind, input: moveInput }, output: closed },
		{ name: 'no key and door shut: short move is kept', input: { state: start, input: { x: 1, y: 0 } }, output: fromStart }
	]);
});

test('Lets the player pass the door once the key is held', () => {
	const moveInput = { x: 3, y: 0 };
	const passed = keyDoor(withKey, moveInput);
	const openDoor = { ...start, x: 5, doorOpen: true };
	const throughOpen = keyDoor(openDoor, { x: 0, y: 0 });
	expect(passed.x).toBe(5.5);
	expect(passed.hasKey).toBe(true);
	expect(throughOpen.x).toBe(5);
	record('lets-the-player-pass-the-door-once-the-key-is-held', 'keyDoor', [
		{ name: 'key held: x may pass 3', input: { state: withKey, input: moveInput }, output: passed },
		{ name: 'door already open: x is not capped', input: { state: openDoor, input: { x: 0, y: 0 } }, output: throughOpen }
	]);
});

test('Clamps movement to the courtyard bounds and rounds it', () => {
	const edgeInput = { x: 0.257, y: 1 };
	const edge = keyDoor({ ...start, x: 9.5, y: 2.9, hasKey: true }, edgeInput);
	const ceiling = keyDoor({ ...start, x: 10, y: 0, hasKey: true }, { x: 1, y: 0 });
	const floor = keyDoor({ ...start, x: 0, y: -3 }, { x: -1, y: -1 });
	expect(edge.x).toBe(9.76);
	expect(edge.y).toBe(3);
	expect(ceiling.x).toBe(10);
	expect(floor).toEqual({ ...start, x: 0, y: -3 });
	record('clamps-movement-to-the-courtyard-bounds-and-rounds-it', 'keyDoor', [
		{ name: 'sum rounds to two decimals and y clamps at 3', input: { state: { ...start, x: 9.5, y: 2.9, hasKey: true }, input: edgeInput }, output: edge },
		{ name: 'x clamps at the top edge of 10', input: { state: { ...start, x: 10, hasKey: true }, input: { x: 1, y: 0 } }, output: ceiling },
		{ name: 'x and y clamp at the bottom edges', input: { state: { ...start, y: -3 }, input: { x: -1, y: -1 } }, output: floor }
	]);
});

test('Keeps the previous choice unless the input sets one', () => {
	const chosen = { ...start, choice: 'vault' };
	const kept = keyDoor(chosen, { x: 0, y: 0 });
	const replaced = keyDoor(chosen, { x: 0, y: -1, choice: 'garden' });
	const cleared = keyDoor(chosen, { x: 0, y: 0, choice: '' });
	expect(kept.choice).toBe('vault');
	expect(replaced.choice).toBe('garden');
	expect(cleared.choice).toBe('');
	record('keeps-the-previous-choice-unless-the-input-sets-one', 'keyDoor', [
		{ name: 'no choice in input keeps vault', input: { state: chosen, input: { x: 0, y: 0 } }, output: kept },
		{ name: 'choice garden replaces vault', input: { state: chosen, input: { x: 0, y: -1, choice: 'garden' } }, output: replaced },
		{ name: 'empty choice string replaces vault', input: { state: chosen, input: { x: 0, y: 0, choice: '' } }, output: cleared }
	]);
});

test('Builds a branching courtyard document for 2d or 3d', () => {
	const flat = exampleDocument();
	const deep = exampleDocument('3d');
	expect(summarise(flat)).toEqual({
		version: 1,
		dimension: '2d',
		checkpoints: ['key', 'door', 'garden', 'vault']
	});
	expect(summarise(deep).dimension).toBe('3d');
	expect(deep.mechanics[0].id).toBe('movement');
	record('builds-a-branching-courtyard-document-for-2d-or-3d', 'exampleDocument', [
		{ name: 'default dimension is 2d', input: {}, output: summarise(flat) },
		{ name: 'explicit 3d dimension is written to the view', input: { dimension: '3d' }, output: summarise(deep) }
	]);
});
