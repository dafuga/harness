import type * as OperatingSystem from 'node:os';

const processor: OperatingSystem.CpuInfo = {
	model: 'Fixture CPU',
	speed: 2400,
	times: { user: 8000, nice: 0, sys: 8000, idle: 44000, irq: 0 }
};

export const processors = [processor, processor, processor, processor];

export const processes = [
	{ pid: 101, parentPid: 1, cpuMs: 1500, role: 'harness', label: 'Harness' },
	{ pid: 202, parentPid: 1, cpuMs: 93784000, role: 'codex', label: 'Codex app' },
	{ pid: 303, parentPid: 1, cpuMs: 5250, role: 'codex', label: 'Codex app' },
	{ pid: 404, parentPid: 303, cpuMs: 400, role: 'agent', label: 'Codex CLI' },
	{ pid: 505, parentPid: 1, cpuMs: 12000, role: 'agent', label: 'Claude' },
	{ pid: 606, parentPid: 1, cpuMs: 2000 }
];

/** Resolves to the error a call rejects with; a call that resolves fails the test. */
export async function rejectionOf(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
	} catch (error) {
		return error;
	}
	throw new Error('Expected the call to reject.');
}
