import type {
	ResourceJob,
	ResourceSnapshot
} from '../../src/core/execution-runtimes/resourceTypes';

/** Authored queue entry; `parent` names an earlier entry whose reservation it nests under. */
export interface ResourceRequestQueueFixture {
	name: string;
	state: ResourceJob['state'];
	cpus: number;
	parent?: string;
}

/** Authored JSON input for one example; the support fixture rebuilds the service from it. */
export interface ResourceRequestExampleFixture {
	outcome: 'request' | 'rejection';
	flags: Record<string, string>;
	telemetry?: Partial<ResourceSnapshot>;
	queue?: ResourceRequestQueueFixture[];
	env?: Record<string, string>;
}

/** Projection of a rejected request: the thrown error's name and the schema paths it reported. */
export interface ResourceRequestRejection {
	name: string;
	issuePaths: PropertyKey[][];
}
