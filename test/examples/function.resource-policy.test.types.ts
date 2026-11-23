import type {
	resourcePolicy,
	impossibleRequest
} from '../../src/services/execution-runtimes/resource-queue-service/resource-policy/resourcePolicy';

export type Snapshot = Parameters<typeof resourcePolicy>[1];

export type Config = Parameters<typeof resourcePolicy>[2];

export type Job = Parameters<typeof resourcePolicy>[0][number];

export type Request = Parameters<typeof impossibleRequest>[0];
