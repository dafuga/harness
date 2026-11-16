import { test } from 'vitest';
import * as gameTypes from '../../src/models/game-authoring/Game.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const ownedTypeNames = [
	'Dimension',
	'Value',
	'GameState',
	'Condition',
	'GameAction',
	'CheckpointImage',
	'Checkpoint',
	'GameView',
	'MechanicDefinition',
	'GameDocument',
	'GameInput',
	'TraceEntry',
	'GameRun',
	'Mechanic',
	'FrameSource',
	'RenderSessionRequest',
	'RenderSession',
	'GameBridge',
	'LevelObject',
	'LevelLayout',
	'LevelProposal',
	'LevelPlanning'
];

test('Imports the Game model without runtime values', () => {
	const runtimeExports = Object.keys(gameTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in gameTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'game.model.game-types',
			symbol: 'Game.types',
			state: 'imports-the-game-model-without-runtime-values',
			evidence: 'examples-cases',
			file: 'imports-the-game-model-without-runtime-values.json'
		},
		[
			{
				name: 'load the model source module',
				input: { module: 'packages/game/src/models/game-authoring/Game.types.ts' },
				output: { runtimeExports }
			},
			{
				name: 'check that each declared type has no runtime binding',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
