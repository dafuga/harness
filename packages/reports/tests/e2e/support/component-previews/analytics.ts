import { stamp } from './shared';
export const cpu = {
	status: 'available',
	sampledAt: stamp,
	logicalCores: 8,
	intervalMs: 1000,
	machinePercent: 18,
	trackedPercent: 6,
	groups: [
		{ id: 'harness', label: 'Harness', machinePercent: 4, corePercent: 32, processes: 3 },
		{ id: 'agents', label: 'Agents', machinePercent: 2, corePercent: 16, processes: 1 }
	],
	agents: [{ label: 'Preview agent', pid: 1234, processes: 1, corePercent: 16, machinePercent: 2 }]
};
