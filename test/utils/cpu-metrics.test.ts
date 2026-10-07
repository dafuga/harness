import { expect, test } from 'vitest';
import { cpuMetrics } from '../../src/utils/cpuMetrics';
test('does not count lifetime CPU for a newly started agent', () => {
	const before = { at: 1000, cpu: { idle: 0, total: 1000, cores: 1 }, processes: [] };
	const after = {
		...before,
		at: 2000,
		processes: [{ pid: 2, parentPid: 1, cpuMs: 10000, role: 'agent' as const, label: 'Claude' }]
	};
	expect(cpuMetrics(before, after).agents[0].corePercent).toBe(0);
});
