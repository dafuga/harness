import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import type { CpuSnapshot } from '../../../../src/utils/development-tooling/cpuMetrics';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { siteProcesses } from '../../src/routes/api/analytics-cpu/siteProcesses';

type Cases = Parameters<typeof recordExampleCases>[1];

const sample: CpuSnapshot = {
	status: 'available',
	sampledAt: '2026-11-15T14:03:27.415Z',
	intervalMs: 2001,
	logicalCores: 8,
	machinePercent: 37.5,
	trackedPercent: 11,
	groups: [
		{ id: 'codex', label: 'Codex app', corePercent: 32, machinePercent: 4, processes: 5 },
		{ id: 'harness', label: 'Harness', corePercent: 12, machinePercent: 1.5, processes: 3 },
		{ id: 'agents', label: 'Local agents', corePercent: 44, machinePercent: 5.5, processes: 6 }
	],
	agents: [
		{ pid: 4127, label: 'Local agent', corePercent: 24, machinePercent: 3, processes: 4 },
		{ pid: 9810, label: 'Local agent', corePercent: 20, machinePercent: 2.5, processes: 2 }
	]
};

function summarise(cpu: CpuSnapshot) {
	return {
		machinePercent: cpu.machinePercent,
		trackedPercent: cpu.trackedPercent,
		agents: cpu.agents.map((agent) => agent.pid),
		agentsGroup: cpu.groups.find((group) => group.id === 'agents')
	};
}

function record(state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'reports.function.site-processes',
			symbol: 'siteProcesses',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function withSiteFolder<T>(run: (folder: string) => T): T {
	const folder = mkdtempSync(join(tmpdir(), 'site-processes-'));
	try {
		return run(folder);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

test('Drops agents whose working directory cannot be told', () => {
	const cpu = siteProcesses(sample, () => undefined);
	const agentsGroup = cpu.groups.find((group) => group.id === 'agents');

	expect(cpu.agents).toEqual([]);
	expect(agentsGroup).toEqual({
		id: 'agents',
		label: 'Local agents',
		corePercent: 0,
		machinePercent: 0,
		processes: 0
	});
	expect(cpu.trackedPercent).toBeCloseTo(5.5);
	record('drops-agents-whose-working-directory-cannot-be-told', [
		{
			name: 'two agents, neither directory can be told',
			input: { agents: [4127, 9810], trackedPercent: 11 },
			output: summarise(cpu)
		}
	]);
});

test('Recalculates the agents group from the agents that remain', () => {
	withSiteFolder((folder) => {
		const cpu = siteProcesses(sample, (pid) => (pid === 9810 ? undefined : folder));
		const agentsGroup = cpu.groups.find((group) => group.id === 'agents');
		const kept = cpu.agents;

		expect(kept.map((agent) => agent.pid)).not.toContain(9810);
		expect(agentsGroup?.processes).toBe(kept.reduce((total, agent) => total + agent.processes, 0));
		expect(agentsGroup?.corePercent).toBe(
			kept.reduce((total, agent) => total + agent.corePercent, 0)
		);
		expect(cpu.groups.slice(0, 2)).toEqual(sample.groups.slice(0, 2));
		expect(cpu.trackedPercent).toBeCloseTo(
			cpu.groups.reduce((total, group) => total + group.machinePercent, 0)
		);
		record('recalculates-the-agents-group-from-the-agents-that-remain', [
			{
				name: 'pid 9810 has no directory, pid 4127 has a temporary folder',
				input: { agents: [4127, 9810], trackedPercent: 11 },
				output: summarise(cpu)
			}
		]);
	});
});

test('Keeps a null tracked percentage and the input unchanged', () => {
	const nullTracked: CpuSnapshot = { ...sample, trackedPercent: null };
	const cpu = siteProcesses(nullTracked, () => undefined);

	expect(cpu.trackedPercent).toBeNull();
	expect(cpu.machinePercent).toBe(37.5);
	expect(nullTracked.agents).toHaveLength(2);
	record('keeps-a-null-tracked-percentage-and-the-input-unchanged', [
		{
			name: 'sample reports no tracked percentage',
			input: { agents: [4127, 9810], trackedPercent: null },
			output: summarise(cpu)
		}
	]);
});

test('Lets a directory lookup error reach the caller', () => {
	const failingLookup = (): string | undefined => {
		throw new Error('fixture lookup failed');
	};

	expect(() => siteProcesses(sample, failingLookup)).toThrow('fixture lookup failed');
	record('lets-a-directory-lookup-error-reach-the-caller', [
		{
			name: 'directory lookup throws for every agent',
			input: { agents: [4127, 9810] },
			error: 'Error: fixture lookup failed'
		}
	]);
});
