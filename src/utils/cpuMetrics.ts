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

export { cpuMetrics } from '../services/cpu-usage-service/cpuMetrics';
