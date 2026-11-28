// @harness-uid u_wlip653voz
import type { TrackerItemPriority } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerAdapterRepository } from '../../repositories/projects-sessions/TrackerAdapterRepository';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type {
	GithubIssueIntakeEvent,
	GithubIssueIntakeIssue
} from '../../helpers/planning-collaboration/planGithubIssueIntake.types';
import type {
	TrackerAdapterCandidate,
	TrackerAdapterRemoteState,
	TrackerAdapterSource,
	TrackerAdapterWorkSource,
	TrackerMessageSource
} from '../../repositories/projects-sessions/TrackerAdapterRepository.types';

export interface TrackerGithubIssue extends GithubIssueIntakeIssue {
	state: TrackerAdapterRemoteState;
	user?: { login?: string };
}

export interface TrackerGithubTimelineEvent extends GithubIssueIntakeEvent {
	actor?: { login?: string };
}

export interface TrackerGithubComment {
	id: number;
	body?: string;
	author_association?: string;
	issue_url: string;
	created_at: string;
	user?: { type?: string; login?: string };
	performed_via_github_app?: unknown;
}

export interface TrackerAdapterReadQuery {
	/** Epoch milliseconds, including the five-second overlap. */
	since: number;
	backfill: boolean;
	signal: AbortSignal;
}

export interface TrackerGithubAdapterProvider {
	/** Yield all pages for the query, including older open issues for explicit backfill. */
	readIssues(
		source: Readonly<TrackerAdapterSource>,
		query: TrackerAdapterReadQuery
	): AsyncIterable<TrackerGithubIssue>;
	readIssue?(
		source: Readonly<TrackerAdapterSource>,
		issue: string,
		signal: AbortSignal
	): Promise<TrackerGithubIssue | undefined>;
	readTimeline(
		source: Readonly<TrackerAdapterSource>,
		issue: number,
		signal: AbortSignal
	): Promise<readonly TrackerGithubTimelineEvent[]>;
	readComments?(
		source: Readonly<TrackerAdapterSource>,
		query: TrackerAdapterReadQuery
	): AsyncIterable<TrackerGithubComment>;
	/** Idempotently add the tracked label. Resolve only after remote acknowledgement. */
	markTracked?(
		source: Readonly<TrackerAdapterSource>,
		issue: string,
		signal: AbortSignal
	): Promise<void>;
}

export interface TrackerAdapterLease {
	owner: string;
	/** Take the shared durable lock exclusively, holding it until the returned release is called. */
	tryAcquire(): (() => void) | null;
}

/** Optional source-specific Tracker presentation and manual adoption rules. */
export interface TrackerAdapterIntakePolicy {
	priority?(
		item: Readonly<TrackerAdapterIntakeRecord>,
		event: Readonly<TrackerAdapterPriorityEvent>
	): TrackerItemPriority;
	titlePrefix?: string;
	matchesItem?: (item: Readonly<TrackerAdapterCandidate>) => boolean;
	instructions?: string;
	followUp?: TrackerGithubFollowUpPolicy;
}

export interface TrackerGithubFollowUpPolicy {
	author: string;
	additionalAuthors?: string[];
	instructions: string;
	coveredComments?: Record<string, string>;
}

export interface TrackerMessageCandidate {
	id: string;
	threadId: string;
	sender?: string;
	receivedAt: number;
	keywordMatched: boolean;
}

export type TrackerMessageProvider = (
	match: Readonly<TrackerMessageSource['match']>,
	query: TrackerAdapterReadQuery
) => AsyncIterable<TrackerMessageCandidate>;

export interface TrackerAdapterPollDependencies {
	lease: TrackerAdapterLease;
	provider: TrackerGithubAdapterProvider;
	messageProviders?: Readonly<
		Partial<Record<TrackerMessageSource['type'], TrackerMessageProvider>>
	>;
	redactText: (text: string) => string;
	intakePolicy?: (source: Readonly<TrackerAdapterSource>) => TrackerAdapterIntakePolicy | undefined;
	now?: () => number;
	itemId?: () => string;
	hasStarted?: (itemId: string) => boolean;
	manual?: boolean;
	dueOwner?: (source: Readonly<TrackerAdapterWorkSource>) => string | null;
}

export interface TrackerAdapterPollOptions {
	dryRun?: boolean;
	backfill?: boolean;
	backfillComments?: boolean;
	signal?: AbortSignal;
}

export interface TrackerAdapterAction {
	priority?: TrackerItemPriority;
	action: 'create' | 'link' | 'covered' | 'notify';
	external_id: string;
	item_id?: string;
	title: string;
	url: string;
	auto_launch: boolean;
}

export interface TrackerAdapterWriteError {
	external_id: string;
	error: string;
}

export type TrackerAdapterPollResult =
	| { status: 'not-owner' | 'lease-busy' | 'inactive' }
	| {
			status: 'polled';
			id: string;
			dry_run: boolean;
			actions: TrackerAdapterAction[];
			events: number;
			synced_back: number;
			deferred?: true;
			sync_errors: TrackerAdapterWriteError[];
	  };

export interface TrackerAdapterEvent {
	id: string;
	time: number;
	note: string;
	state?: TrackerAdapterRemoteState;
	nudge?: boolean;
}

export interface TrackerAdapterPriorityEvent {
	actor?: string;
	kind: 'issue' | 'comment';
}

export interface TrackerAdapterIntakeRecord {
	actor?: string;
	externalId: string;
	key: string;
	title: string;
	url: string;
	notes: string;
	state: TrackerAdapterRemoteState;
	historical: boolean;
	autoLaunch: boolean;
	syncBack: boolean;
	events: TrackerAdapterEvent[];
	snapshotAt: number;
	followUp?: { instructions: string; coveredItem?: string };
	acceptanceInstructions?: string;
}

export interface TrackerAdapterCommentEvent extends TrackerAdapterEvent {
	actor?: string;
	key: string;
}

export interface TrackerAdapterIntakeContext {
	repository: TrackerAdapterRepository;
	store: TrackerPersistenceService;
	dependencies: TrackerAdapterPollDependencies;
	policy?: TrackerAdapterIntakePolicy;
}
