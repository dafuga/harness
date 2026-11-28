import { expect, test } from 'vitest';
import { resourceArguments } from '../scripts/with-resources';
import { checkSteps, runSteps } from '../scripts/run-checks';

test('resource script preserves argv boundaries, defaults and explicit admission controls', () => {
	const command = ['sh', '-c', 'printf "%s" "$@"', '--', 'spaces ; $literal'];
	expect(resourceArguments(['agent-test', '--', ...command], {})).toEqual([
		'resources',
		'run',
		'--priority',
		'agent-test',
		'--cpus',
		'1',
		'--memory-mib',
		'2048',
		'--',
		...command
	]);
	expect(
		resourceArguments(['coding', '--', ...command], {
			HARNESS_RESOURCE_PRIORITY: 'environment',
			HARNESS_RESOURCE_CPUS: '2',
			HARNESS_RESOURCE_MEMORY_MIB: '3072'
		})
	).toEqual([
		'resources',
		'run',
		'--priority',
		'environment',
		'--cpus',
		'2',
		'--memory-mib',
		'3072',
		'--',
		...command
	]);
	expect(
		resourceArguments(['coding', '--', ...command], {
			HARNESS_RESOURCE_PRIORITY: '',
			HARNESS_RESOURCE_CPUS: '',
			HARNESS_RESOURCE_MEMORY_MIB: ''
		})
	).toEqual(resourceArguments(['coding', '--', ...command], {}));
	const fullCheck = ['bun', 'scripts/run-checks.ts', '--part', 'static-unit'];
	const managed = resourceArguments(['agent-test', '--', ...fullCheck], {});
	const separator = managed.indexOf('--');
	expect(managed.slice(separator + 1)).toEqual(fullCheck);
	expect(managed.slice(0, separator)).toContain('Full repository check');
	expect(
		resourceArguments(['agent-test', '--', 'sh', '-c', 'playwright test "$@"', '--'], {})
	).toContain('--heavy-test');
	for (const args of [[], ['coding'], ['coding', '--'], ['unknown', '--', 'true']])
		expect(() => resourceArguments(args, {})).toThrow('Usage:');
});

test('check steps report time, stop at failure and preserve the complete broad gate order', async () => {
	const invoked: string[] = [],
		lines: string[] = [];
	const run = async (name: string) => {
		invoked.push(name);
		return name === 'second' ? 7 : 0;
	};
	expect(await runSteps(['first', 'second', 'third'], run, (line) => lines.push(line))).toBe(7);
	expect(invoked).toEqual(['first', 'second']);
	expect(lines).toEqual([
		'[check 1/3] first',
		expect.stringMatching(/first: passed in [\d.]+ ms/),
		'[check 2/3] second',
		expect.stringMatching(/second: failed \(7\) in [\d.]+ ms/)
	]);
	expect(await runSteps([], run, (line) => lines.push(line))).toBe(0);
	expect(
		await runSteps(
			['broken'],
			async () => {
				throw new Error('cannot start');
			},
			(line) => lines.push(line)
		)
	).toBe(1);
	expect(lines.at(-1)).toMatch(/broken: failed \(1\) in [\d.]+ ms/);
	expect(checkSteps).toEqual([
		'check:verification-forwards',
		'check:debt-ratchets',
		'check:e2e-list',
		'check:doc-links',
		'check:feature-status',
		'format:check',
		'typecheck',
		'lint',
		'check:kernel',
		'build:kernel',
		'test:unit',
		'test:e2e',
		'build',
		'test:package',
		'audit:root',
		'units:check',
		'check:reports-source',
		'check:planning',
		'check:desktop',
		'check:collaboration',
		'check:hub',
		'check:remote',
		'check:relay',
		'check:game'
	]);
});
