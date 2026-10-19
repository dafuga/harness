

export type CpuRole = 'codex' | 'harness' | 'agent';

export interface CpuProcess {
	pid: number;
	parentPid: number;
	cpuMs: number;
	role?: CpuRole;
	label?: string;
}

export { cpuProcesses } from '../adapters/cpu-process-adapter/cpuProcesses';
