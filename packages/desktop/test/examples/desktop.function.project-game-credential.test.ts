import { afterEach, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectGameCredentialAdapter } from '../../src/adapters/game-authoring/ProjectGameCredentialAdapter';
import { ProjectGameCredentialError } from '../../src/adapters/game-authoring/ProjectGameCredentialAdapter.types';
import type { GameCredentialName } from '../../src/adapters/game-authoring/ProjectGameCredentialAdapter.types';

const directories: string[] = [];

function temporaryDirectory(prefix: string): string {
	const directory = mkdtempSync(join(tmpdir(), `${prefix}-`));
	directories.push(directory);
	return directory;
}

function ignoredGit(directory: string): void {
	const bin = join(directory, 'bin');
	mkdirSync(bin);
	const executable = join(bin, 'git');
	writeFileSync(executable, '#!/bin/sh\nif [ "$3" = "check-ignore" ]; then echo .env.local; fi\n');
	chmodSync(executable, 0o755);
	vi.stubEnv('PATH', bin);
}

afterEach(() => {
	vi.unstubAllEnvs();
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test('Reads requested keys from an ignored project credential file', async () => {
	const root = temporaryDirectory('game-credential-project');
	ignoredGit(root);
	const values: Record<GameCredentialName, string> = {
		HARNESS_GAME_OPENAI_API_KEY: 'example-openai-key-4f9a2c7e1b',
		HARNESS_GAME_DECART_API_KEY: 'example-decart-key-8d3e6b0a5c'
	};
	writeFileSync(
		join(root, '.env.local'),
		`${Object.entries(values).map(([name, value]) => `${name}="${value}"`).join('\n')}\n`
	);
	const adapter = new ProjectGameCredentialAdapter(root);
	const output = await adapter.read('HARNESS_GAME_OPENAI_API_KEY');
	expect(output).toBe(values.HARNESS_GAME_OPENAI_API_KEY);
	recordExampleCases(
		{
			unitId: 'desktop.function.project-game-credential',
			symbol: 'read',
			state: 'reads-requested-keys-from-an-ignored-project-credential-file',
			evidence: 'examples-cases',
			file: 'reads-requested-keys-from-an-ignored-project-credential-file.json'
		},
		[
			{
				name: 'Reads the requested OpenAI key after Git reports the file ignored',
				input: { root: '/workspace/projects/forest-quest', name: 'HARNESS_GAME_OPENAI_API_KEY' },
				output
			}
		]
	);
});

test('Rejects a missing project credential file', async () => {
	const root = temporaryDirectory('game-credential-missing');
	const adapter = new ProjectGameCredentialAdapter(root);
	let error: unknown;
	try {
		await adapter.read('HARNESS_GAME_DECART_API_KEY');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(ProjectGameCredentialError);
	const result = error instanceof Error ? { name: error.name, message: error.message } : null;
	recordExampleCases(
		{
			unitId: 'desktop.function.project-game-credential',
			symbol: 'read',
			state: 'rejects-a-missing-project-credential-file',
			evidence: 'examples-cases',
			file: 'rejects-a-missing-project-credential-file.json'
		},
		[
			{
				name: 'Missing file rejects with the project-owned configuration message',
				input: { root: '/workspace/projects/tide-runner', name: 'HARNESS_GAME_DECART_API_KEY' },
				error: result
			}
		]
	);
});
