import { test } from 'vitest';
import { gameRenderOptions } from '../../src/components/game-authoring/game-preview/gameRenderOptions';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Returns the supported video preview options', () => {
	const options = gameRenderOptions();

	expect(options).toEqual({
		restyle: { label: 'Lucy Restyle', model: 'lucy-restyle-2', fast: false, rate: 0.6 },
		lucy: { label: 'Lucy 2.5', model: 'lucy-2.5', fast: false, rate: 1.2 },
		fast: { label: 'Lucy 2.5 Fast', model: 'lucy-2.5', fast: true, rate: 2.4 }
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.game-render-options',
			symbol: 'gameRenderOptions',
			state: 'returns-the-supported-video-preview-options',
			evidence: 'examples-cases',
			file: 'returns-the-supported-video-preview-options.json'
		},
		[
			{
				name: 'get the fixed model labels and session rates',
				input: {},
				output: options
			}
		]
	);
});
