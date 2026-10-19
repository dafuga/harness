import type { CpuProcess } from './cpuProcesses';
export interface CpuReading {
	at: number;
	cpu: { idle: number; total: number; cores: number };
	processes: CpuProcess[];
}
export interface CpuGroup {
	id: string;
	label: string;
	corePercent: number;
	machinePercent: number;
	processes: number;
}
export interface CpuSnapshot {
	status: 'available' | 'unavailable';
	sampledAt: string;
	intervalMs: number;
	logicalCores: number;
	machinePercent: number | null;
	trackedPercent: number | null;
	groups: CpuGroup[];
	agents: (Omit<CpuGroup, 'id'> & { pid: number })[];
}
export function cpuMetrics(before: CpuReading, after: CpuReading): CpuSnapshot {
	const intervalMs = after.at - before.at;
	const cores = after.cpu.cores;
	const total = after.cpu.total - before.cpu.total;
	const idle = after.cpu.idle - before.cpu.idle;
	const machinePercent = total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : null;
	const { groups, agents } = collectUsage(before, after);
	return {
		status: 'available',
		sampledAt: new Date().toISOString(),
		intervalMs,
		logicalCores: cores,
		machinePercent,
		trackedPercent: groups.reduce((sum, g) => sum + g.machinePercent, 0),
		groups,
		agents: [...agents.values()].sort((a, b) => b.corePercent - a.corePercent)
	};
}
function collectUsage(before: CpuReading, after: CpuReading) {
	const intervalMs = after.at - before.at;
	const cores = after.cpu.cores;
	const previous = new Map(before.processes.map((p) => [p.pid, p]));
	const current = new Map(after.processes.map((p) => [p.pid, p]));
	const groups = ['codex', 'harness', 'agents'].map((id, i) => ({
		id,
		label: ['Codex app', 'Harness', 'Local agents'][i],
		corePercent: 0,
		machinePercent: 0,
		processes: 0
	}));
	const agents = new Map<number, CpuSnapshot['agents'][number]>();
	for (const p of after.processes) {
		const owner = processOwner(p, current);
		if (!owner) continue;
		const delta = previous.has(p.pid) ? Math.max(0, p.cpuMs - previous.get(p.pid)!.cpuMs) : 0;
		const percent = intervalMs > 0 ? (delta / intervalMs) * 100 : 0;
		const group = groups.find((g) => g.id === (owner.role === 'agent' ? 'agents' : owner.role))!;
		addUsage(group, percent, cores);
		if (owner.role !== 'agent') continue;
		const agent = agents.get(owner.pid) ?? {
			pid: owner.pid,
			label: owner.label ?? 'Local agent',
			corePercent: 0,
			machinePercent: 0,
			processes: 0
		};
		addUsage(agent, percent, cores);
		agents.set(owner.pid, agent);
	}
	return { groups, agents };
}
function processOwner(p: CpuProcess, processes: Map<number, CpuProcess>): CpuProcess | undefined {
	const seen = new Set<number>();
	let current: CpuProcess | undefined = p;
	while (current && !seen.has(current.pid)) {
		if (current.role) return current;
		seen.add(current.pid);
		current = processes.get(current.parentPid);
	}
	return undefined;
}
function addUsage(group: Omit<CpuGroup, 'id'>, percent: number, cores: number): void {
	group.corePercent += percent;
	group.machinePercent += cores ? percent / cores : 0;
	group.processes++;
}
