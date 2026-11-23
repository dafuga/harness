import type { Spawn, Launch } from './script.desktop-experiment-launcher.test.types';
import { dirname, join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

vi.mock('node:os', () => ({ homedir: () => '/made-up/home' }));

const dataPath = join('/made-up/home', 'Library/Application Support/Codex Harness Experimental');
const executable = join(dirname(process.execPath), 'CodexHarnessElectron');
const meta = { unitId: 'script.desktop-experiment-launcher', symbol: 'module' };

// Runs the script's top-level code with a fake Bun.spawn, a no-op process.exit and a fake argv.
async function launch(args: string[], spawn: Spawn): Promise<Launch> {
	const result: Launch = { spawned: [] };
	const argv = process.argv;
	process.argv = [...argv.slice(0, 2), ...args];
	vi.stubGlobal('Bun', {
		spawn: (command: string[], options: unknown) => {
			result.spawned.push(command);
			return spawn(command, options);
		}
	});
	vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
		result.exitCode = Number(code);
		return undefined as never;
	});
	vi.resetModules();
	try {
		await import('../../scripts/desktop-experiment-launcher');
	} catch (caught) {
		result.error = (caught as Error).message;
	} finally {
		process.argv = argv;
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	}
	return result;
}

test('Forwards the child exit code', async () => {
	const args = ['--inspect-disabled', 'exp-1'];
	const output = await launch(args, () => ({ exited: Promise.resolve(3) }));

	expect(output.spawned).toHaveLength(1);
	expect(output.spawned[0]).toEqual([executable, `--user-data-dir=${dataPath}`, ...args]);
	expect(output.exitCode).toBe(3);
	expect(output.error).toBeUndefined();

	recordExampleCases(
		{ ...meta, state: 'forwards-the-child-exit-code', evidence: 'examples-cases', file: 'forwards-the-child-exit-code.json' },
		[
			{
				name: 'runs the executable with the data dir and forwards exit code 3',
				input: args,
				output: { command: output.spawned[0], exitCode: output.exitCode }
			}
		]
	);
});

test('Propagates a spawn failure', async () => {
	const output = await launch(['exp-2'], () => {
		throw new Error('spawn CodexHarnessElectron ENOENT');
	});

	expect(output.spawned).toHaveLength(1);
	expect(output.exitCode).toBeUndefined();
	expect(output.error).toBe('spawn CodexHarnessElectron ENOENT');

	recordExampleCases(
		{ ...meta, state: 'propagates-a-spawn-failure', evidence: 'examples-cases', file: 'propagates-a-spawn-failure.json' },
		[
			{
				name: 'missing executable makes the import reject with the spawn error',
				input: ['exp-2'],
				error: { name: 'Error', message: output.error }
			}
		]
	);
});
