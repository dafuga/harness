import type { ResourceJob } from '../../src/core/execution-runtimes/resourceTypes';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Job = Omit<ResourceJob, 'sequence'>;

export type Cases = Parameters<typeof recordExampleCases>[1];
