import { expect, test } from 'vitest';
import { CpuProcessAdapter } from '../../src/adapters/CpuProcessAdapter';
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
