import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { cpuMetrics } from '../../src/services/development-tooling/cpu-usage-service/cpuMetrics';
import type { CpuReading } from '../../src/utils/development-tooling/cpuMetrics';

const before = {
	at: 52817.349,
	cpu: { idle: 91234567, total: 118765432, cores: 8 },
	processes: [
		{ pid: 4312, parentPid: 1, cpuMs: 184230, role: 'harness', label: 'Harness' },
		{ pid: 9120, parentPid: 4312, cpuMs: 61840, role: 'agent', label: 'Claude' },
		{ pid: 9164, parentPid: 9120, cpuMs: 22410 },
		{ pid: 881, parentPid: 1, cpuMs: 912340, role: 'codex', label: 'Codex app' }
	]
} satisfies CpuReading;

const after = {
	at: 53818.112,
	cpu: { idle: 91239767, total: 118773432, cores: 8 },
	processes: [
		{ pid: 4312, parentPid: 1, cpuMs: 184290, role: 'harness', label: 'Harness' },
		{ pid: 9120, parentPid: 4312, cpuMs: 62840, role: 'agent', label: 'Claude' },
		{ pid: 9164, parentPid: 9120, cpuMs: 22910 },
		{ pid: 881, parentPid: 1, cpuMs: 912890, role: 'codex', label: 'Codex app' }
	]
} satisfies CpuReading;

test('Attributes interval CPU to the nearest recognized owner', () => {
	const snapshot = cpuMetrics(before, after);
	const result = {
		intervalMs: snapshot.intervalMs,
		logicalCores: snapshot.logicalCores,
		machinePercent: snapshot.machinePercent,
		trackedPercent: snapshot.trackedPercent,
		groups: snapshot.groups,
		agents: snapshot.agents
	};
	expect(result.intervalMs).toBeCloseTo(1000.763);
	expect(result.groups.map(({ id, processes }) => ({ id, processes }))).toEqual([
		{ id: 'codex', processes: 1 },
		{ id: 'harness', processes: 1 },
		{ id: 'agents', processes: 2 }
	]);
	expect(result.agents[0]).toMatchObject({ pid: 9120, label: 'Claude', processes: 2 });
	recordExampleCases(
		{
			unitId: 'function.cpu-metrics',
			symbol: 'cpuMetrics',
			state: 'attributes-interval-cpu-to-the-nearest-recognized-owner',
			evidence: 'examples-cases',
			file: 'attributes-interval-cpu-to-the-nearest-recognized-owner.json'
		},
		[
			{
				name: 'nested agent and child deltas are assigned to their nearest owner',
				input: { before, after },
				output: result
			}
		]
	);
});
