import { test } from 'vitest';
import { gameScaffoldDetails } from '../../src/templates/game-authoring/gameScaffoldDetails';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Provides game scaffold details', () => {
	expect(Object.keys(gameScaffoldDetails)).toEqual(['game-view', 'mechanic', 'checkpoint']);
	recordExampleCases(
		{
			unitId: 'template.game-scaffold-details',
			symbol: 'gameScaffoldDetails',
			state: 'provides-game-scaffold-details',
			evidence: 'examples-cases',
			file: 'provides-game-scaffold-details.json'
		},
		[
			{
				name: 'game view, mechanic, and checkpoint contain their scaffold guidance',
				input: {},
				output: gameScaffoldDetails
			}
		]
	);
});
