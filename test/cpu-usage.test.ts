import { describe, expect, it } from 'vitest';
import { CpuUsageService } from '../src/services/CpuUsageService';
import { cpuProcesses } from '../src/utils/cpuProcesses';
import { cpuMetrics } from '../src/utils/cpuMetrics';
const rows = `10 1 0:01.00 /Applications/Codex.app/Contents/MacOS/Codex
11 10 0:02.00 /Applications/Codex.app/Contents/Resources/codex app-server
12 11 0:00.50 /usr/bin/tool --secret=never-export-this
20 11 0:01.00 /usr/local/bin/claude
21 20 0:00.50 /usr/bin/tool
30 11 0:00.50 bun /projects/harness/src/index.ts report serve
31 30 0:00.50 node /projects/harness/dist/reports/build/index.js
40 1 1-01:02:03 /usr/bin/other`;
describe('live CPU measurement', () => {
	it('parses CPU time and emits only safe process identities', () => {
		const processes = cpuProcesses(rows, 30);
		expect(processes.find((p) => p.pid === 40)?.cpuMs).toBe(90123000);
		expect(JSON.stringify(processes)).not.toContain('never-export-this');
	});
	it('uses interval deltas, separates nested agents and Harness without double counting', () => {
		const processes = cpuProcesses(rows, 30);
		const before = { at: 1000, cpu: { idle: 1000, total: 2000, cores: 4 }, processes };
		const after = {
			at: 2000,
			cpu: { idle: 3000, total: 6000, cores: 4 },
			processes: processes.map((p) => ({ ...p, cpuMs: p.cpuMs + (p.pid === 40 ? 0 : 100) }))
		};
		const sample = cpuMetrics(before, after);
		expect(sample.machinePercent).toBe(50);
		expect(sample.groups.map((g) => [g.id, g.corePercent])).toEqual([
			['codex', 30],
			['harness', 20],
			['agents', 20]
		]);
		expect(sample.trackedPercent).toBe(17.5);
		expect(sample.agents).toMatchObject([
			{ pid: 20, label: 'Claude', corePercent: 20, processes: 2 }
		]);
	});
	it('ignores new processes and counter resets and reports unavailable counters', () => {
		const base = {
			at: 1000,
			cpu: { idle: 0, total: 0, cores: 4 },
			processes: cpuProcesses(rows, 30)
		};
		const result = cpuMetrics(base, {
			...base,
			at: 2000,
			processes: base.processes.map((p) => ({ ...p, cpuMs: 0 }))
		});
		expect(result.machinePercent).toBeNull();
		expect(result.trackedPercent).toBe(0);
	});
	it('returns an explicit unavailable snapshot on process permission errors', async () => {
		const adapter = {
			sample: async () => {
				throw new Error('permission denied private path');
			}
		};
		const result = await new CpuUsageService(adapter).snapshot();
		expect(result.status).toBe('unavailable');
		expect(result.machinePercent).toBeNull();
		expect(JSON.stringify(result)).not.toContain('private path');
	});
});
