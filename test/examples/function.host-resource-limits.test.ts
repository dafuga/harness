import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { hostResourceLimits } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostResourceLimits';

const UNIT = 'function.host-resource-limits';
const SYMBOL = 'hostResourceLimits';
const JOB_TREE: Record<string, string> = {
	'sys/cgroup.controllers': 'cpu memory\n',
	'sys/app/job/cpu.max': '200000 100000\n',
	'sys/app/job/cpu.stat': 'usage_usec 125000\nuser_usec 100000\n',
	'sys/app/job/memory.max': '1073741824\n',
	'sys/app/job/memory.current': '536870912\n'
};

function meta(state: string) {
	return { unitId: UNIT, symbol: SYMBOL, state, evidence: 'examples-cases', file: `${state}.json` };
}

function writeFiles(base: string, files: Record<string, string>): void {
	for (const [name, text] of Object.entries(files)) {
		const file = join(base, name);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
}

function thrownMessage(call: () => unknown): string {
	try {
		call();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	return 'no error';
}

test('Returns an empty limits object on non-Linux systems', () => {
	const limits = hostResourceLimits('/unused/root', '/unused/proc', 'darwin');
	expect(limits).toEqual({});
	recordExampleCases(meta('returns-an-empty-limits-object-on-non-linux-systems'), [
		{ name: 'darwin host reports no cgroup limits', input: { system: 'darwin' }, output: limits }
	]);
});

test('Reads the tightest cgroup v2 quota from ancestors', () => {
	return withTempDir('host-limits-', (directory) => {
		writeFiles(directory, { ...JOB_TREE, 'proc-self-cgroup': '0::/app/job\n' });
		const limits = hostResourceLimits(
			join(directory, 'sys'),
			join(directory, 'proc-self-cgroup'),
			'linux'
		);
		expect(limits).toEqual({
			cores: 2,
			cpuUsedUs: 125000,
			memoryTotalBytes: 1073741824,
			memoryAvailableBytes: 536870912
		});
		recordExampleCases(meta('reads-the-tightest-cgroup-v2-quota-from-ancestors'), [
			{
				name: 'job cgroup sets cpu and memory quotas',
				input: { membership: '0::/app/job', cpuMax: '200000 100000', memoryMax: '1073741824' },
				output: limits
			}
		]);
	});
});

test('Rejects a membership path that climbs out of the root', () => {
	return withTempDir('host-limits-', (directory) => {
		writeFiles(directory, { ...JOB_TREE, 'proc-self-cgroup': '0::/app/../../etc\n' });
		const message = thrownMessage(() =>
			hostResourceLimits(join(directory, 'sys'), join(directory, 'proc-self-cgroup'), 'linux')
		);
		expect(message).toBe('Invalid cgroup path');
		recordExampleCases(meta('rejects-a-membership-path-that-climbs-out-of-the-root'), [
			{
				name: 'membership path contains a parent segment',
				input: { membership: '0::/app/../../etc' },
				error: message
			}
		]);
	});
});
