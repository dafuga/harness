import type { launchEventFixture } from './trackerLaunchEventFixture';

export type LaunchEventFixture = ReturnType<typeof launchEventFixture>;

export interface LaunchEventFixtureOptions {
	scheduleDue?: boolean;
}

export interface LaunchEventState {
	at: number;
	exited: Set<string>;
	startupFailures: Map<string, number>;
	sent: Record<string, unknown>[];
}
