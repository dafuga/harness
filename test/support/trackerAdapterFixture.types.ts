import type { DatabaseSync } from 'node:sqlite';
import type {
	TrackerAdapterLease,
	TrackerAdapterPollDependencies,
	TrackerGithubIssue,
	TrackerGithubTimelineEvent
} from '../../src/services/projects-sessions/TrackerAdapterPollService.types';

export interface TrackerAdapterFixtureOptions {
	node?: string;
	lease?: TrackerAdapterLease;
	database?: DatabaseSync;
	redactText?: TrackerAdapterPollDependencies['redactText'];
}

export interface TrackerAdapterFeed {
	now: number;
	issues: TrackerGithubIssue[];
	timeline: TrackerGithubTimelineEvent[];
	failRead: boolean;
	started: boolean;
	failWrite: boolean;
}
