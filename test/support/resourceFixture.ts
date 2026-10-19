import { randomUUID } from 'node:crypto';
import {
	resourceConfigSchema,
	resourceRequestSchema,
	mib,
	type ResourceSnapshot,
	type ResourceJob
} from '../../src/core/resourceTypes';
export const config = resourceConfigSchema.parse({ pollMs: 250 });
export function snapshot(changes: Partial<ResourceSnapshot> = {}): ResourceSnapshot {
	return {
		status: 'available',
		sampledAt: Date.now(),
		logicalCores: 10,
		usableCores: 10,
		cpuUsedPercent: 0,
		cpuAvailableCores: 10,
		memoryTotalBytes: 16 * 1024 * mib,
		memoryAvailableBytes: 16 * 1024 * mib,
		memoryPressure: 'normal',
		...changes
	};
}
export function job(changes: Partial<ResourceJob> = {}): ResourceJob {
	return {
		...resourceRequestSchema.parse({}),
		id: randomUUID(),
		sequence: 1,
		ownerPid: process.pid,
		ownerStarted: 'fixture owner',
		state: 'queued',
		createdAt: Date.now(),
		heartbeatAt: Date.now(),
		notice: null,
		...changes
	};
}
