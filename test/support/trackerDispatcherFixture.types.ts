import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDuePolicy
} from '../../src/services/agents-providers/TrackerDispatcherService.types';

export interface DispatcherFixtureOptions {
	item?: Partial<TrackerDispatchItem>;
	policy?: Partial<TrackerDispatchPolicy>;
	due?: TrackerDuePolicy;
}

export interface DispatcherFixtureConditions {
	openSession?: boolean;
	activeSessionKeys?: readonly string[];
	due?: TrackerDuePolicy;
}
