import { test } from 'vitest';
import {
	impossibleRequest,
	memoryReserve,
	resourcePolicy,
	resourcePressure
} from '../../src/services/execution-runtimes/resource-queue-service/resource-policy/resourcePolicy';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type Snapshot = Parameters<typeof resourcePolicy>[1];
type Config = Parameters<typeof resourcePolicy>[2];
type Job = Parameters<typeof resourcePolicy>[0][number];
type Request = Parameters<typeof impossibleRequest>[0];

const now = 1_000_000;
const MIB = 1024 * 1024;
const unitId = 'function.resource-policy';
const config: Config = {
	schemaVersion: 1,
	cpuReservePercent: 10,
	memoryReservePercent: 10,
	minMemoryReserveMiB: 2048,
	pollMs: 1000,
	staleSampleMs: 5000
};
const healthy: Snapshot = {
	status: 'available',
	sampledAt: now,
	logicalCores: 8,
	usableCores: 8,
	cpuUsedPercent: 25,
	cpuAvailableCores: 6,
	memoryTotalBytes: 16384 * MIB,
	memoryAvailableBytes: 8192 * MIB,
	memoryPressure: 'normal'
};
const base = {
	priority: 'coding',
	cpus: 1,
	memoryMiB: 1024,
	label: 'Managed work',
	sequence: 1,
	ownerPid: 101,
	ownerStarted: 'fixture-owner',
	state: 'queued',
	createdAt: now,
	heartbeatAt: now,
	notice: null
} as const;

function makeJob(id: string, fields: Partial<Job>): Job {
	return { ...base, id, ...fields };
}

function requestOf(cpus: number, memoryMiB: number): Request {
	return { priority: 'coding', cpus, memoryMiB, label: 'Fixture request' };
}

function summary(job: Job) {
	return {
		id: job.id,
		state: job.state,
		priority: job.priority,
		cpus: job.cpus,
		memoryMiB: job.memoryMiB,
		parentId: job.parentId ?? null
	};
}

function policyCase(name: string, jobs: Job[], sample: Snapshot) {
	return {
		name,
		input: {
			jobs: jobs.map(summary),
			cpuAvailableCores: sample.cpuAvailableCores,
			memoryAvailableMiB: sample.memoryAvailableBytes / MIB
		},
		output: resourcePolicy(jobs, sample, config, now)
	};
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Pressure reports stale telemetry and exhausted reserves', () => {
	const stale: Snapshot = { ...healthy, sampledAt: now - 6000 };
	const starvedCpu: Snapshot = { ...healthy, cpuAvailableCores: 0.5 };
	const starvedMemory: Snapshot = { ...healthy, memoryAvailableBytes: 1024 * MIB };
	const warning: Snapshot = { ...healthy, memoryPressure: 'warning' };
	expect(resourcePressure(healthy, config, now)).toBeNull();
	expect(resourcePressure(stale, config, now)).toBe('Resource telemetry is unavailable or stale');
	expect(resourcePressure(starvedCpu, config, now)).toBe('CPU reserve is exhausted');
	expect(resourcePressure(starvedMemory, config, now)).toBe('Memory reserve is exhausted');
	expect(resourcePressure(warning, config, now)).toBe('Memory pressure is warning');
	recordCases('resourcePressure', 'pressure-reports-stale-telemetry-and-exhausted-reserves', [
		{
			name: 'healthy host leaves admissions open',
			input: { ageMs: 0, cpuAvailableCores: 6, memoryAvailableMiB: 8192 },
			output: null
		},
		{
			name: 'sample older than staleSampleMs',
			input: { ageMs: 6000, cpuAvailableCores: 6, memoryAvailableMiB: 8192 },
			output: 'Resource telemetry is unavailable or stale'
		},
		{
			name: 'CPU below the 0.8-core reserve',
			input: { ageMs: 0, cpuAvailableCores: 0.5, memoryAvailableMiB: 8192 },
			output: 'CPU reserve is exhausted'
		},
		{
			name: 'memory below the 2048 MiB floor',
			input: { ageMs: 0, cpuAvailableCores: 6, memoryAvailableMiB: 1024 },
			output: 'Memory reserve is exhausted'
		},
		{
			name: 'memory warning pauses new admissions',
			input: {
				ageMs: 0,
				cpuAvailableCores: 6,
				memoryAvailableMiB: 8192,
				memoryPressure: 'warning'
			},
			output: resourcePressure(warning, config, now)
		}
	]);
});

test('Memory reserve keeps the larger of percent and floor', () => {
	const large: Snapshot = { ...healthy, memoryTotalBytes: 40960 * MIB };
	expect(memoryReserve(healthy, config)).toBe(2147483648);
	expect(memoryReserve(large, config)).toBe(4294967296);
	recordCases('memoryReserve', 'memory-reserve-keeps-the-larger-of-percent-and-floor', [
		{
			name: 'floor wins on a 16 GiB host',
			input: { memoryTotalMiB: 16384, memoryReservePercent: 10, minMemoryReserveMiB: 2048 },
			output: 2147483648
		},
		{
			name: 'percentage wins on a 40 GiB host',
			input: { memoryTotalMiB: 40960, memoryReservePercent: 10, minMemoryReserveMiB: 2048 },
			output: 4294967296
		}
	]);
});

test('Impossible requests exceed capacity after reserves', () => {
	const unavailable: Snapshot = { ...healthy, status: 'unavailable' };
	expect(impossibleRequest(requestOf(4, 4096), healthy, config)).toBe(false);
	expect(impossibleRequest(requestOf(8, 1024), healthy, config)).toBe(true);
	expect(impossibleRequest(requestOf(1, 15000), healthy, config)).toBe(true);
	expect(impossibleRequest(requestOf(8, 1024), unavailable, config)).toBe(false);
	recordCases('impossibleRequest', 'impossible-requests-exceed-capacity-after-reserves', [
		{
			name: 'fits within 7.2 cores and 14336 MiB',
			input: { cpus: 4, memoryMiB: 4096, status: 'available' },
			output: false
		},
		{
			name: 'needs 8 cores of 7.2 usable',
			input: { cpus: 8, memoryMiB: 1024, status: 'available' },
			output: true
		},
		{
			name: 'needs 15000 MiB of 14336 usable',
			input: { cpus: 1, memoryMiB: 15000, status: 'available' },
			output: true
		},
		{
			name: 'unavailable telemetry is not judged',
			input: { cpus: 8, memoryMiB: 1024, status: 'unavailable' },
			output: false
		}
	]);
});

test('Priority queue grants roots and children within budgets', () => {
	const roots = [
		makeJob('q1', { cpus: 2, memoryMiB: 2048, sequence: 1 }),
		makeJob('q2', { priority: 'environment', cpus: 1, memoryMiB: 1024, sequence: 2 }),
		makeJob('q3', { priority: 'agent-test', cpus: 4, memoryMiB: 4096, sequence: 3 })
	];
	const busy = [
		makeJob('r1', { state: 'running', cpus: 3, memoryMiB: 2048, sequence: 1 }),
		makeJob('q1', { cpus: 2, memoryMiB: 2048, sequence: 2 })
	];
	const nested = [
		makeJob('p1', { state: 'running', cpus: 2, memoryMiB: 2048, sequence: 1 }),
		makeJob('c1', { parentId: 'p1', cpus: 1, memoryMiB: 1024, sequence: 2 }),
		makeJob('c2', { parentId: 'p1', cpus: 2, memoryMiB: 1024, sequence: 3 })
	];
	const starvedCpu: Snapshot = { ...healthy, cpuAvailableCores: 0.5 };
	expect(resourcePolicy(roots, healthy, config, now)).toEqual({ granted: ['q3'], reason: null });
	expect(resourcePolicy(busy, healthy, config, now)).toEqual({ granted: ['q1'], reason: null });
	expect(resourcePolicy(busy, starvedCpu, config, now)).toEqual({
		granted: [],
		reason: 'CPU reserve is exhausted'
	});
	expect(resourcePolicy(nested, healthy, config, now)).toEqual({ granted: ['c1'], reason: null });
	recordCases('resourcePolicy', 'priority-queue-grants-roots-and-children-within-budgets', [
		policyCase('agent-test first; coding then blocked by remaining CPU', roots, healthy),
		policyCase('queued root fits beside a running root', busy, healthy),
		policyCase('CPU reserve exhausted admits nothing', busy, starvedCpu),
		policyCase('child fits parent budget; sibling exceeds it', nested, healthy)
	]);
});
