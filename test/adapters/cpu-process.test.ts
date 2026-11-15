import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { CpuProcessAdapter } from '../../src/services/development-tooling/cpu-usage-service/cpu-process-adapter/CpuProcessAdapter';
test('native CPU sampler reads real monotonic counters without arguments', async () => {
	if (!['darwin', 'linux'].includes(process.platform)) return;
	const sample = await new CpuProcessAdapter().sample();
	expect(sample.cpu.cores).toBeGreaterThan(0);
	expect(sample.processes.find((p) => p.pid === process.pid)?.role).toBe('harness');
	expect(
		sample.processes.every((p) =>
			Object.keys(p).every((key) => ['pid', 'parentPid', 'cpuMs', 'role', 'label'].includes(key))
		)
	).toBe(true);
});

test('the relocated CPU process modules leave no stub at the old adapter path', () => {
	const stubs = ['CpuProcessAdapter.ts', 'cpuProcesses.ts'].map((file) =>
		resolve(import.meta.dirname, '../../src/adapters/cpu-process-adapter', file)
	);
	expect(stubs.filter((stub) => existsSync(stub))).toEqual([]);
});
