import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { assertDocument } from '../../src/validators/game-authoring/gameDocument';
import { createRun, stepGame } from '../../src/utils/game-authoring/gameStep';
import { exampleDocument } from '../../src/utils/game-authoring/keyDoor';

const documentState = 'validates-game-documents';
const stepState = 'steps-a-ready-view';

function rejectedDocument(input: unknown): { name: string; message: string } {
	try {
		assertDocument(input);
	} catch (error) {
		const actual = error as Error;
		return { name: actual.name, message: actual.message };
	}
	throw new Error('Expected document to be rejected.');
}

function rejectedMovement(): { name: string; message: string } {
	const view = exampleDocument().views[0];
	try {
		stepGame(createRun(), { x: Number.NaN, y: 0 }, view);
	} catch (error) {
		const actual = error as Error;
		return { name: actual.name, message: actual.message };
	}
	throw new Error('Expected movement to be rejected.');
}

test('Validates game documents', () => {
	const valid = exampleDocument();
	assertDocument(valid);
	expect(valid.version).toBe(1);
	const invalid = { version: 2 };
	const error = rejectedDocument(invalid);
	expect(error.message).toBe('Invalid game document');
	recordExampleCases(
		{
			unitId: 'game.entry.index',
			symbol: 'assertDocument',
			state: documentState,
			evidence: 'examples-cases',
			file: `${documentState}.json`
		},
		[
			{ name: 'accepts the example game', input: valid, output: { version: valid.version, views: valid.views.length } },
			{ name: 'rejects an incomplete game', input: invalid, error }
		]
	);
});

test('Steps a ready view', () => {
	const view = exampleDocument().views[0];
	const run = stepGame(createRun(), { x: 1, y: 0.5 }, view);
	expect(run.tick).toBe(1);
	expect(run.state.x).toBe(1);
	const error = rejectedMovement();
	expect(error.message).toBe('Movement must be finite.');
	recordExampleCases(
		{
			unitId: 'game.entry.index',
			symbol: 'stepGame',
			state: stepState,
			evidence: 'examples-cases',
			file: `${stepState}.json`
		},
		[
			{ name: 'moves within the ready view', input: { x: 1, y: 0.5 }, output: { tick: run.tick, x: run.state.x, y: run.state.y } },
			{ name: 'rejects non-finite movement', input: { x: 'NaN', y: 0 }, error }
		]
	);
});
