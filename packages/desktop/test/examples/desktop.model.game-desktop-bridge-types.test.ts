import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { GameDesktopBridge } from '../../src/models/game-authoring/GameDesktopBridge.types';

const bridgeFixture: GameDesktopBridge = {
	gameImageRead: async ({ projectId, path, commit }) => `${projectId}:${path}:${commit ?? 'head'}`
};

test('accepts a bridge implementation with an image reader', async () => {
	const input = { projectId: 'sample-game', path: 'images/forest.png' };
	const imageReference = await bridgeFixture.gameImageRead?.(input);

	expect(imageReference).toBe('sample-game:images/forest.png:head');
	recordExampleCases(
		{
			unitId: 'desktop.model.game-desktop-bridge-types',
			symbol: 'GameDesktopBridge',
			state: 'accepts-a-bridge-implementation-with-an-image-reader',
			evidence: 'examples-cases',
			file: 'accepts-a-bridge-implementation-with-an-image-reader.json'
		},
		[
			{
				name: 'read an image at the current project head',
				input: { bridge: 'gameImageRead', ...input },
				output: imageReference
			}
		]
	);
});
