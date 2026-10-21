export type CpuRole = 'codex' | 'harness' | 'agent';

export interface CpuProcess {
	pid: number;
	parentPid: number;
	cpuMs: number;
	role?: CpuRole;
	label?: string;
}

export { cpuProcesses } from '../../services/development-tooling/cpu-usage-service/cpu-process-adapter/cpuProcesses';
