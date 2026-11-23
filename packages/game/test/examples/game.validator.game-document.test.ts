import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	InvalidGameDocumentError,
	validateDocument,
	assertDocument
} from '../../src/validators/game-authoring/gameDocument';
import type { RecordValue } from '../../src/validators/game-authoring/gameDocument.types';

const unitId = 'game.validator.game-document';

const keyMechanic: RecordValue = {
	id: 'mechanic-key-door',
	title: 'Key door',
	description: 'Opens the lab door once the key is found.',
	inputs: ['keyFound'],
	events: ['door-opened']
};

function campus(target: string): RecordValue {
	return {
		id: 'view-campus',
		title: 'Campus',
		dimension: '2d',
		style: 'pixel-art',
		checkpoints: [
			{
				id: 'checkpoint-library',
				title: 'Library',
				description: 'Go to the next room once the key is found.',
				x: 120,
				y: 80,
				requires: [],
				conditions: [],
				actions: [{ target, type: 'transition', value: true }]
			}
		]
	};
}

function lab(): RecordValue {
	return { id: 'view-lab', title: 'Lab', dimension: '3d', style: 'clean', checkpoints: [] };
}

function document(views: RecordValue[], mechanics: RecordValue[] = []): RecordValue {
	return { version: 1, views, mechanics };
}

function thrownBy(input: unknown): { name: string; message: string } {
	let caught: unknown;
	try {
		assertDocument(input);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(InvalidGameDocumentError);
	const error = caught as InvalidGameDocumentError;
	return { name: error.name, message: error.message };
}

test('Validates documents against the game document rules', () => {
	const inputs = [
		document([campus('view-lab'), lab()], [keyMechanic]),
		document([campus('view-cellar')]),
		{ version: 2, views: [], mechanics: [] }
	];
	const outputs = inputs.map((input) => validateDocument(input));
	expect(outputs).toEqual([[], ['Unknown view: view-cellar'], ['Invalid game document']]);

	recordExampleCases(
		{
			unitId,
			symbol: 'validateDocument',
			state: 'validates-documents-against-the-game-document-rules',
			evidence: 'examples-cases',
			file: 'validates-documents-against-the-game-document-rules.json'
		},
		[
			{
				name: 'valid document with a transition and a mechanic',
				input: inputs[0],
				output: outputs[0]
			},
			{ name: 'transition to an unknown view', input: inputs[1], output: outputs[1] },
			{ name: 'unsupported version', input: inputs[2], output: outputs[2] }
		]
	);
});

test('Rejects a view entry that is not an object', () => {
	const inputs = [
		{ version: 1, views: ['view-campus'], mechanics: [] },
		{ version: 1, views: [campus('view-lab'), 7], mechanics: [] }
	];
	const outputs = inputs.map((input) => validateDocument(input));
	expect(outputs).toEqual([['Invalid game view'], ['Invalid game view']]);

	recordExampleCases(
		{
			unitId,
			symbol: 'validateDocument',
			state: 'rejects-a-view-entry-that-is-not-an-object',
			evidence: 'examples-cases',
			file: 'rejects-a-view-entry-that-is-not-an-object.json'
		},
		[
			{ name: 'string in place of a view', input: inputs[0], output: outputs[0] },
			{ name: 'number after a valid view', input: inputs[1], output: outputs[1] }
		]
	);
});

test('assertDocument throws on invalid documents only', () => {
	const valid = document([campus('view-lab'), lab()], [keyMechanic]);
	const invalid = document([campus('view-cellar')]);
	expect(assertDocument(valid)).toBeUndefined();
	const error = thrownBy(invalid);
	expect(error).toEqual({
		name: 'InvalidGameDocumentError',
		message: 'Unknown view: view-cellar'
	});

	recordExampleCases(
		{
			unitId,
			symbol: 'assertDocument',
			state: 'assertdocument-throws-on-invalid-documents-only',
			evidence: 'examples-cases',
			file: 'assertdocument-throws-on-invalid-documents-only.json'
		},
		[
			{ name: 'valid document returns normally', input: valid, output: { returned: true } },
			{ name: 'unknown transition target throws', input: invalid, error }
		]
	);
});
