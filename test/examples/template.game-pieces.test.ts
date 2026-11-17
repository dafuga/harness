import { test } from 'vitest';
import { gameViewFiles, mechanicFiles, checkpointFiles } from '../../src/templates/game-authoring/gamePieces';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Generates a game view config', () => {
	const output = gameViewFiles('inventory', { dimension: '2d' });
	expect(output[0].path).toBe('src/configs/inventoryViewConfig.ts');
	expect(output[0].contents).toContain("dimension: '2d'");
	recordExampleCases(
		{
			unitId: 'template.game-pieces',
			symbol: 'gameViewFiles',
			state: 'generates-a-game-view-config',
			evidence: 'examples-cases',
			file: 'generates-a-game-view-config.json'
		},
		[{ name: 'inventory view in 2d', input: { name: 'inventory', dimension: '2d' }, output }]
	);
});

test('Generates a mechanic utility and test', () => {
	const output = mechanicFiles('dash');
	expect(output).toHaveLength(2);
	expect(output[0].contents).toContain('return {};');
	recordExampleCases(
		{
			unitId: 'template.game-pieces',
			symbol: 'mechanicFiles',
			state: 'generates-a-mechanic-utility-and-test',
			evidence: 'examples-cases',
			file: 'generates-a-mechanic-utility-and-test.json'
		},
		[{ name: 'dash mechanic', input: { name: 'dash' }, output }]
	);
});

test('Generates a checkpoint config', () => {
	const output = checkpointFiles('spawn');
	expect(output[0].path).toBe('src/configs/spawnCheckpointConfig.ts');
	expect(output[0].contents).toContain("title: 'Spawn'");
	recordExampleCases(
		{
			unitId: 'template.game-pieces',
			symbol: 'checkpointFiles',
			state: 'generates-a-checkpoint-config',
			evidence: 'examples-cases',
			file: 'generates-a-checkpoint-config.json'
		},
		[{ name: 'spawn checkpoint', input: { name: 'spawn' }, output }]
	);
});

test('Throws ExpectedCliError when dimension is missing', () => {
	const message = 'A game view needs harness.dimension 2d or 3d in package.json.';
	expect(() => gameViewFiles('inventory', {})).toThrow(message);
	recordExampleCases(
		{
			unitId: 'template.game-pieces',
			symbol: 'gameViewFiles',
			state: 'throws-expectedclierror-when-dimension-is-missing',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-dimension-is-missing.json'
		},
		[
			{
				name: 'view without dimension',
				input: { name: 'inventory', dimension: undefined },
				error: { name: 'ExpectedCliError', message }
			}
		]
	);
});
