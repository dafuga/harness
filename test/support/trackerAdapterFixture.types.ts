import type { DatabaseSync } from 'node:sqlite';
import type {
	TrackerAdapterLease,
	TrackerAdapterPollDependencies,
	TrackerGithubComment,
	TrackerGithubIssue,
	TrackerGithubTimelineEvent
} from '../../src/services/projects-sessions/TrackerAdapterPollService.types';

export interface TrackerAdapterFixtureOptions {
	node?: string;
	lease?: TrackerAdapterLease;
	database?: DatabaseSync;
	redactText?: TrackerAdapterPollDependencies['redactText'];
	intakePolicy?: TrackerAdapterPollDependencies['intakePolicy'];
}

export interface TrackerAdapterFeed {
	now: number;
	issues: TrackerGithubIssue[];
	timeline: TrackerGithubTimelineEvent[];
	comments: TrackerGithubComment[];
	failRead: boolean;
	started: boolean;
	failWrite: boolean;
}
