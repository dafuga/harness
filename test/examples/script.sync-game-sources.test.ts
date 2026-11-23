import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { embeddedSource, gameSourceLayout } from '../../scripts/sync-game-sources';
import { UnembeddedImportError } from '../../scripts/sync-game-sources.types';

test('Rewrites imports for the generated game destination', async () => {
	const destination = 'validators/LevelValidator.ts';
	const text =
		"import { gameStep } from '../../utils/game-authoring/gameStep';\nexport const validate = gameStep;\n";
	const output = await embeddedSource(destination, text);
	expect(output).toContain("from '../utils/gameStep'");
	const cases = [
		{
			name: 'rewrites a mapped engine import to its generated destination',
			input: { destination, text },
			output: {
				rewrittenImport: "from '../utils/gameStep'",
				formatted: output.includes('export const validate = gameStep;')
			}
		}
	];
	recordExampleCases(
		{
			unitId: 'script.sync-game-sources',
			symbol: 'embeddedSource',
			state: 'rewrites-imports-for-the-generated-game-destination',
			evidence: 'examples-cases',
			file: 'rewrites-imports-for-the-generated-game-destination.json'
		},
		cases
	);
	expect(Object.keys(gameSourceLayout)).toContain(destination);
});

test('Rejects imports that are not embedded', async () => {
	const destination = 'validators/LevelValidator.ts';
	const text = "import { missing } from './privateHelper';\n";
	let error: unknown;
	try {
		await embeddedSource(destination, text);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(UnembeddedImportError);
	const actual = error as UnembeddedImportError;
	const output = { name: actual.name, message: actual.message };
	const cases = [
		{
			name: 'rejects a relative import whose engine source is not embedded',
			input: { destination, text },
			error: output
		}
	];
	recordExampleCases(
		{
			unitId: 'script.sync-game-sources',
			symbol: 'embeddedSource',
			state: 'rejects-imports-that-are-not-embedded',
			evidence: 'examples-cases',
			file: 'rejects-imports-that-are-not-embedded.json'
		},
		cases
	);
});
