import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GameLevelService } from '../../src/lib/development-tooling/desktop-bridge/GameLevelService';
import type { LevelRequest } from '../../src/lib/development-tooling/desktop-bridge/GameLevelService.types';

const request: LevelRequest = {
	projectId: 'local-9c4e1a7f2b8d3e60a5c1f9b74d2e8a3c6f0b5d1e9a7c2f4b8e3d6a0c1f5b9e72',
	document: {
		version: 1,
		views: [
			{
				id: 'view-mhb4q9xr',
				title: 'Courtyard level',
				dimension: '3d',
				style: 'Low-poly stone courtyard at dusk with warm lantern light.',
				checkpoints: [],
				planning: {
					concept: 'Walled courtyard with a raised platform',
					description: 'Climb the central platform and reach the east wall goal.'
				}
			}
		],
		mechanics: []
	},
	viewId: 'view-mhb4q9xr',
	expectedRevision: '5a0e7c39d4b18f62e9c3a7d10b6f48e27c95d3a0f1e8b26c4d7a09e53b2c8f10',
	provider: 'claude',
	model: 'claude-opus-5-5'
};

function makeService(root: string, busy: boolean) {
	const session = {
		busy,
		assertProject: (_projectId: string) => undefined,
		mutable: async () => ({ root })
	} as unknown as ConstructorParameters<typeof GameLevelService>[0];
	const providers = {} as ConstructorParameters<typeof GameLevelService>[1];
	return new GameLevelService(session, providers);
}

function describeError(error: unknown) {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: 'UnknownError', message: String(error) };
}

test('Rejects generation while the project session is busy', async () => {
	const root = mkdtempSync(join(tmpdir(), 'game-level-busy-'));
	try {
		let failure: ReturnType<typeof describeError> | undefined;
		try {
			await makeService(root, true).generate(request);
		} catch (error) {
			failure = describeError(error);
		}
		expect(failure).toEqual({
			name: 'LevelGenerationError',
			message: 'Wait for the current game operation.'
		});
		recordExampleCases(
			{
				unitId: 'desktop.service.game-level',
				symbol: 'generate',
				state: 'rejects-generation-while-the-project-session-is-busy',
				evidence: 'examples-cases',
				file: 'rejects-generation-while-the-project-session-is-busy.json'
			},
			[
				{
					name: 'Busy project operations prevent a model turn',
					input: { request, sessionBusy: true },
					error: failure
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Rejects a view without a complete planning brief', async () => {
	const root = mkdtempSync(join(tmpdir(), 'game-level-brief-'));
	try {
		const incomplete: LevelRequest = {
			...request,
			document: {
				...request.document,
				views: request.document.views.map((view) => ({
					...view,
					planning: { concept: '   ', description: 'A route to the goal.' }
				}))
			}
		};
		let failure: ReturnType<typeof describeError> | undefined;
		try {
			await makeService(root, false).generate(incomplete);
		} catch (error) {
			failure = describeError(error);
		}
		expect(failure).toEqual({
			name: 'LevelGenerationError',
			message: 'Describe the concept and level brief first.'
		});
		recordExampleCases(
			{
				unitId: 'desktop.service.game-level',
				symbol: 'generate',
				state: 'rejects-a-view-without-a-complete-planning-brief',
				evidence: 'examples-cases',
				file: 'rejects-a-view-without-a-complete-planning-brief.json'
			},
			[
				{
					name: 'Blank planning concepts are refused before provider selection',
					input: { request: incomplete, sessionBusy: false },
					error: failure
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
