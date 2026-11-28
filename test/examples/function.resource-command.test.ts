import { readFileSync, writeFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { resourceCommand } from '../../src/utils/execution-runtimes/resourceCommand';
import { InvalidResourceCommandInputError } from '../../src/utils/execution-runtimes/resourceCommand.types';

const unitId = 'function.resource-command';

function stateMeta(state: string) {
	return {
		unitId,
		symbol: 'resourceCommand',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function writeScript(directory: string, name: string, body: string): string {
	const path = join(directory, name);
	writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
	return path;
}

function fixtureContext(home: string, track: (pid: number) => void = () => undefined) {
	return {
		id: 'fixture-run',
		env: { HARNESS_RESOURCES_HOME: home, PATH: '/usr/bin:/bin' },
		track
	};
}

test('Runs a managed command and resolves its exit status', async () => {
	await withTempDir('resource-command-exit-', async (directory) => {
		const context = fixtureContext(join(directory, 'home'));
		const passing = writeScript(directory, 'pass.sh', 'exit 0');
		const failing = writeScript(directory, 'fail.sh', 'exit 2');
		const passed = await resourceCommand([passing], context, undefined, 30000);
		const failed = await resourceCommand([failing], context);
		expect(passed).toBe(0);
		expect(failed).toBe(2);
		if (process.platform === 'darwin') {
			const observation = join(directory, 'priority');
			const testScript = writeScript(
				directory,
				'test.sh',
				`/bin/sh -c '/bin/ps -o nice= -p "$$" > "$1"' child "$1"`
			);
			context.env = { ...context.env, ...{ HARNESS_RESOURCE_PRIORITY: 'agent-test' } };
			expect(await resourceCommand([testScript, observation], context)).toBe(0);
			expect(Number(readFileSync(observation, 'utf8'))).toBe(Math.max(10, getPriority()));
		}
		recordExampleCases(stateMeta('runs-a-managed-command-and-resolves-its-exit-status'), [
			{
				name: 'fake command exits 0 with a 30000 ms timeout',
				input: { args: ['pass.sh'], timeoutMs: 30000 },
				output: passed
			},
			{
				name: 'fake command exits 2 with the default timeout',
				input: { args: ['fail.sh'] },
				output: failed
			}
		]);
	});
});

test('Rejects empty commands and invalid timeouts before starting', async () => {
	await withTempDir('resource-command-reject-', async (directory) => {
		const context = fixtureContext(join(directory, 'home'));
		const emptyError = 'A managed command is required after --';
		const timeoutError = 'Invalid managed command timeout';
		await expect(resourceCommand([], context)).rejects.toThrow(emptyError);
		await expect(resourceCommand(['npm', 'test'], context, undefined, 0)).rejects.toThrow(
			timeoutError
		);
		await expect(
			resourceCommand(['npm', 'test'], context, undefined, 2147483648)
		).rejects.toBeInstanceOf(InvalidResourceCommandInputError);
		const rejection = (message: string) => ({ name: 'InvalidResourceCommandInputError', message });
		recordExampleCases(stateMeta('rejects-empty-commands-and-invalid-timeouts-before-starting'), [
			{
				name: 'args array is empty',
				input: { args: [], timeoutMs: 21600000 },
				error: rejection(emptyError)
			},
			{
				name: 'timeout is 0',
				input: { args: ['npm', 'test'], timeoutMs: 0 },
				error: rejection(timeoutError)
			},
			{
				name: 'timeout is above the native timer limit',
				input: { args: ['npm', 'test'], timeoutMs: 2147483648 },
				error: rejection(timeoutError)
			}
		]);
	});
});

test('Rejects an already aborted signal before starting', async () => {
	await withTempDir('resource-command-abort-', async (directory) => {
		const pids: number[] = [];
		const context = fixtureContext(join(directory, 'home'), (pid) => {
			pids.push(pid);
		});
		const script = writeScript(directory, 'pass.sh', 'exit 0');
		const controller = new AbortController();
		controller.abort('operator cancelled');
		await expect(resourceCommand([script], context, controller.signal)).rejects.toBe(
			'operator cancelled'
		);
		expect(pids).toEqual([]);
		recordExampleCases(stateMeta('rejects-an-already-aborted-signal-before-starting'), [
			{
				name: 'signal is aborted with a string reason before the call',
				input: { args: ['pass.sh'], signal: 'aborted' },
				error: 'operator cancelled'
			}
		]);
	});
});

test('Resolves 1 when tracking the spawned process throws', async () => {
	await withTempDir('resource-command-track-', async (directory) => {
		const context = fixtureContext(join(directory, 'home'), () => {
			throw new Error('track refused');
		});
		const hold = writeScript(directory, 'hold.sh', 'sleep 5');
		const status = await resourceCommand([hold], context);
		expect(status).toBe(1);
		recordExampleCases(stateMeta('resolves-1-when-tracking-the-spawned-process-throws'), [
			{
				name: 'track callback throws for the spawned process id',
				input: { args: ['hold.sh'], track: 'throws' },
				output: status
			}
		]);
	});
});

test('Stops a command that outlives its timeout', async () => {
	await withTempDir('resource-command-timeout-', async (directory) => {
		const context = fixtureContext(join(directory, 'home'));
		const hold = writeScript(directory, 'hold.sh', 'sleep 5');
		const status = await resourceCommand([hold], context, undefined, 200);
		expect(status).not.toBe(0);
		recordExampleCases(stateMeta('stops-a-command-that-outlives-its-timeout'), [
			{
				name: 'fake command sleeps 5 seconds with a 200 ms timeout',
				input: { args: ['hold.sh'], timeoutMs: 200 },
				output: status
			}
		]);
	});
});
