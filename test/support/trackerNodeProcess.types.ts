import type { TrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';

export interface TrackerNodeFixture {
	path: string;
	config: TrackerNodeConfig;
	env?: Record<string, string>;
}

export interface TrackerFixtureResult {
	code: number | null;
	stdout: string;
	stderr: string;
}

export type TrackerFixtureReceipts = Map<string, { path: string; body: unknown }>;
