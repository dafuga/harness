import type { z } from 'zod';
import type {
	resourceConfigSchema,
	resourceJobSchema,
	resourceRequestSchema
} from './resourceTypes';

export type ResourceConfig = z.infer<typeof resourceConfigSchema>;

export type ResourceRequest = z.infer<typeof resourceRequestSchema>;

export interface ResourceSnapshot {
	status: 'available' | 'unavailable';
	sampledAt: number;
	logicalCores: number;
	usableCores: number;
	cpuUsedPercent: number | null;
	cpuAvailableCores: number;
	memoryTotalBytes: number;
	memoryAvailableBytes: number;
	memoryPressure: 'normal' | 'warning' | 'critical' | 'unknown';
	reason?: string;
}

export type ResourceJob = z.infer<typeof resourceJobSchema>;

export interface ResourceContext {
	id: string;
	env: Record<string, string | undefined>;
	track(pid: number): void;
}
