import { fileURLToPath } from 'node:url';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

// The script has no exports: importing it runs it. Its Bun.spawnSync call and
// process.exit are stubbed so nothing real is started.
const scriptPath = fileURLToPath(new URL('../../scripts/harness-audit.ts', import.meta.url));
const fakeCliPath = '/made-up/harness-cli.ts';

type SpawnCall = { command: string[] };
type ScriptRun = { calls: SpawnCall[]; exits: number[] };

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
