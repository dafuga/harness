import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { resourceArguments } from '../../scripts/with-resources';

const USAGE = 'Usage: with-resources <coding|agent-test|environment> -- <command...>';

function usageError(
	args: string[],
	env: Record<string, string | undefined>
): { name: string; message: string } {
	let error: unknown;
	try {
		resourceArguments(args, env);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	expect(actual.message).toBe(USAGE);
	return { name: actual.name, message: actual.message };
}

test('Builds the resource command with defaults and env overrides', () => {
	const defaultArgs = ['coding', '--', 'bun', 'test'];
	const defaultOutput = resourceArguments(defaultArgs, {});
	expect(defaultOutput).toEqual([
		'resources',
		'run',
		'--priority',
		'coding',
		'--cpus',
		'1',
		'--memory-mib',
		'2048',
		'--',
		'bun',
		'test'
	]);

	const overrideArgs = ['environment', '--', 'node', '--version'];
	const overrideEnv = {
		HARNESS_RESOURCE_PRIORITY: 'agent-test',
		HARNESS_RESOURCE_CPUS: '4',
		HARNESS_RESOURCE_MEMORY_MIB: '8192'
	};
	const overrideOutput = resourceArguments(overrideArgs, overrideEnv);
	expect(overrideOutput).toEqual([
		'resources',
		'run',
		'--priority',
		'agent-test',
		'--cpus',
		'4',
		'--memory-mib',
		'8192',
		'--',
		'node',
		'--version'
	]);

	const partialArgs = ['agent-test', '--', 'bun', 'run', 'build'];
	const partialEnv = { HARNESS_RESOURCE_CPUS: '2', HARNESS_RESOURCE_MEMORY_MIB: '' };
	const partialOutput = resourceArguments(partialArgs, partialEnv);
	expect(partialOutput).toEqual([
		'resources',
		'run',
		'--priority',
		'agent-test',
		'--cpus',
		'2',
		'--memory-mib',
		'2048',
		'--',
		'bun',
		'run',
		'build'
	]);

	recordExampleCases(
		{
			unitId: 'script.with-resources',
			symbol: 'resourceArguments',
			state: 'builds-the-resource-command-with-defaults-and-env-overrides',
			evidence: 'examples-cases',
			file: 'builds-the-resource-command-with-defaults-and-env-overrides.json'
		},
		[
			{
				name: 'coding with empty env uses defaults',
				input: { args: defaultArgs, env: {} },
				output: defaultOutput
			},
			{
				name: 'environment with priority, cpus and memory overrides',
				input: { args: overrideArgs, env: overrideEnv },
				output: overrideOutput
			},
			{
				name: 'empty memory env falls back to 2048 and cpus override applies',
				input: { args: partialArgs, env: partialEnv },
				output: partialOutput
			}
		]
	);
});

test('Rejects a bad priority, missing separator and empty command', () => {
	const cases = [
		{ args: ['APP', '--', 'bun', 'test'], env: {} },
		{ args: ['coding', 'bun', 'test'], env: {} },
		{ args: ['coding', '--'], env: {} }
	].map(({ args, env }) => ({
		name: `rejects ${JSON.stringify(args)}`,
		input: { args, env },
		error: usageError(args, env)
	}));

	recordExampleCases(
		{
			unitId: 'script.with-resources',
			symbol: 'resourceArguments',
			state: 'rejects-a-bad-priority-missing-separator-and-empty-command',
			evidence: 'examples-cases',
			file: 'rejects-a-bad-priority-missing-separator-and-empty-command.json'
		},
		cases
	);
});
