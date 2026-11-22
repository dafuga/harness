import type { ScriptRun, SpawnCall } from './game.script.harness-audit.test.types';
import { fileURLToPath } from 'node:url';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

// The script has no exports: importing it runs it. Its Bun.spawnSync call and
// process.exit are stubbed so nothing real is started.
const scriptPath = fileURLToPath(new URL('../../scripts/harness-audit.ts', import.meta.url));
const fakeCliPath = '/made-up/harness-cli.ts';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.resetModules();
});

async function runScript(cliPath: string, exitCode: number): Promise<ScriptRun> {
	const calls: SpawnCall[] = [];
	const exits: number[] = [];
	vi.stubEnv('HARNESS_CLI_PATH', cliPath);
	vi.stubGlobal('Bun', {
		spawnSync: (command: string[]) => {
			calls.push({ command });
			return { exitCode };
		}
	});
	vi.spyOn(globalThis.process, 'exit').mockImplementation(((code?: number) => {
		exits.push(code ?? -1);
	}) as never);
	vi.resetModules();
	await import(scriptPath);
	return { calls, exits };
}

async function runUnstartable(cliPath: string): Promise<{ command: string[]; error: unknown; exits: number[] }> {
	const calls: SpawnCall[] = [];
	const exits: number[] = [];
	vi.stubEnv('HARNESS_CLI_PATH', cliPath);
	vi.stubGlobal('Bun', {
		spawnSync: (command: string[]) => {
			calls.push({ command });
			throw new Error(`Executable not found: ${command[0]}`);
		}
	});
	vi.spyOn(globalThis.process, 'exit').mockImplementation(((code?: number) => {
		exits.push(code ?? -1);
	}) as never);
	vi.resetModules();
	let error: unknown;
	try {
		await import(scriptPath);
	} catch (caught) {
		error = caught;
	}
	return { command: calls[0]?.command ?? [], error, exits };
}

test('Runs harness audit with the lib profile', async () => {
	const run = await runScript('', 0);
	expect(run.calls).toEqual([{ command: ['harness', 'audit', '.', '--profile', 'lib'] }]);
	expect(run.exits).toEqual([0]);

	recordExampleCases(
		{
			unitId: 'game.script.harness-audit',
			symbol: 'Bun.spawnSync',
			state: 'runs-harness-audit-with-the-lib-profile',
			evidence: 'examples-cases',
			file: 'runs-harness-audit-with-the-lib-profile.json'
		},
		[{ name: 'HARNESS_CLI_PATH unset', input: { HARNESS_CLI_PATH: '' }, output: run }]
	);
});

test('Runs the bundled CLI through bun when set', async () => {
	const run = await runScript(fakeCliPath, 0);
	expect(run.calls).toEqual([
		{ command: ['bun', fakeCliPath, 'audit', '.', '--profile', 'lib'] }
	]);
	expect(run.exits).toEqual([0]);

	recordExampleCases(
		{
			unitId: 'game.script.harness-audit',
			symbol: 'Bun.spawnSync',
			state: 'runs-the-bundled-cli-through-bun-when-set',
			evidence: 'examples-cases',
			file: 'runs-the-bundled-cli-through-bun-when-set.json'
		},
		[{ name: 'HARNESS_CLI_PATH set', input: { HARNESS_CLI_PATH: fakeCliPath }, output: run }]
	);
});

test('Passes the audit exit code to process exit', async () => {
	const run = await runScript('', 3);
	expect(run.exits).toEqual([3]);

	recordExampleCases(
		{
			unitId: 'game.script.harness-audit',
			symbol: 'process.exit',
			state: 'passes-the-audit-exit-code-to-process-exit',
			evidence: 'examples-cases',
			file: 'passes-the-audit-exit-code-to-process-exit.json'
		},
		[{ name: 'audit exits with code 3', input: { exitCode: 3 }, output: run }]
	);
});

test('Throws Error when bun cannot be started', async () => {
	const run = await runUnstartable(fakeCliPath);
	expect(run.command).toEqual(['bun', fakeCliPath, 'audit', '.', '--profile', 'lib']);
	expect(run.error).toBeInstanceOf(Error);
	const actual = run.error as Error;
	expect(actual.message).toBe('Executable not found: bun');
	expect(run.exits).toEqual([]);

	recordExampleCases(
		{
			unitId: 'game.script.harness-audit',
			symbol: 'Bun.spawnSync',
			state: 'throws-error-when-bun-cannot-be-started',
			evidence: 'examples-cases',
			file: 'throws-error-when-bun-cannot-be-started.json'
		},
		[
			{
				name: 'HARNESS_CLI_PATH set and bun not found',
				input: { HARNESS_CLI_PATH: fakeCliPath },
				error: { name: actual.name, message: actual.message }
			}
		]
	);
});

test('Throws Error when harness cannot be started', async () => {
	const run = await runUnstartable('');
	expect(run.command).toEqual(['harness', 'audit', '.', '--profile', 'lib']);
	expect(run.error).toBeInstanceOf(Error);
	const actual = run.error as Error;
	expect(actual.message).toBe('Executable not found: harness');
	expect(run.exits).toEqual([]);

	recordExampleCases(
		{
			unitId: 'game.script.harness-audit',
			symbol: 'Bun.spawnSync',
			state: 'throws-error-when-harness-cannot-be-started',
			evidence: 'examples-cases',
			file: 'throws-error-when-harness-cannot-be-started.json'
		},
		[
			{
				name: 'HARNESS_CLI_PATH unset and harness not found',
				input: { HARNESS_CLI_PATH: '' },
				error: { name: actual.name, message: actual.message }
			}
		]
	);
});
