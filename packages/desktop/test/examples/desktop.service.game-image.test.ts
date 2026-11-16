import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GameImageService } from '../../src/lib/development-tooling/desktop-bridge/GameImageService';
import { GameImageRequestError } from '../../src/lib/development-tooling/desktop-bridge/GameImageService.types';
import type { Request } from '../../src/lib/development-tooling/desktop-bridge/GameImageService.types';

const input: Request = {
	projectId: 'local-eb2550296df60349f873e96b4ce1dc657b286b209e3688a90f73348bbef047d2',
	document: {
		version: 1,
		views: [
			{
				id: 'view-forest',
				title: 'Forest Crossing',
				dimension: '2d',
				style: 'hand-painted pixel art',
				checkpoints: [
					{
						imagePrompt: 'Warm sunrise filtering through pine trees.',
						id: 'checkpoint-bridge',
						title: 'Old Bridge',
						description: 'Reach the weathered bridge at the forest edge.',
						x: 4,
						y: 2,
						requires: [],
						conditions: [],
						actions: []
					}
				]
			}
		],
		mechanics: []
	},
	viewId: 'view-forest',
	checkpointId: 'checkpoint-bridge',
	expectedRevision: '1dac9c48ebc7f9172354b0bdd83b67d18d6ea5ce635eaa78e6c9ecb5deec9d66'
};

test('Refuses image generation while the project is busy', async () => {
	const session = {
		busy: true,
		assertProject: () => undefined,
		mutable: async () => ({ root: '/tmp/game-image-example' })
	};
	const service = new GameImageService(session as never, { generate: async () => Buffer.alloc(0) });
	let failure: unknown;
	try {
		await service.generate(input);
	} catch (error) {
		failure = error;
	}
	expect(failure).toBeInstanceOf(GameImageRequestError);
	expect((failure as Error).message).toBe('Wait for the current game operation.');
	recordExampleCases(
		{
			unitId: 'desktop.service.game-image',
			symbol: 'generate',
			state: 'refuses-image-generation-while-the-project-is-busy',
			evidence: 'examples-cases',
			file: 'refuses-image-generation-while-the-project-is-busy.json'
		},
		[
			{
				name: 'Busy project rejects checkpoint image generation',
				input,
				error: { name: 'GameImageRequestError', message: 'Wait for the current game operation.' }
			}
		]
	);
});
