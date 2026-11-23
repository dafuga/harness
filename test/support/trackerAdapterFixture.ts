import { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import { TrackerAdapterLeaseAdapter } from '../../src/adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import type {
	TrackerAdapterLease,
	TrackerAdapterReadQuery,
	TrackerGithubIssue
} from '../../src/services/projects-sessions/TrackerAdapterPollService.types';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type {
	TrackerAdapterFeed,
	TrackerAdapterFixtureOptions
} from './trackerAdapterFixture.types';

export const adapterSourceId = 'github:example/widgets';
export const adapterEnabledAt = 10_000;

export function adapterIssue(overrides: Partial<TrackerGithubIssue> = {}): TrackerGithubIssue {
	return {
		id: 100,
		number: 17,
		title: 'Fixture issue',
		state: 'open',
		created_at: new Date(12_000).toISOString(),
		updated_at: new Date(12_000).toISOString(),
		labels: [],
		user: { login: 'fixture-author' },
		...overrides
	};
}

export function adapterFixture(options: TrackerAdapterFixtureOptions = {}) {
	const database = options.database ?? new DatabaseSync(':memory:');
	const node = options.node ?? 'fixture-owner';
	const feed: TrackerAdapterFeed = {
		now: 30_000,
		issues: [adapterIssue()],
		timeline: [],
		comments: [],
		failRead: false,
		started: false,
		failWrite: false
	};
	const readIssues = vi.fn(async function* (_source: unknown, _query: TrackerAdapterReadQuery) {
		yield* feed.issues;
		if (feed.failRead) throw new Error('synthetic provider body');
	});
	const readTimeline = vi.fn(async () => feed.timeline);
	const readIssue = vi.fn(fixtureIssueLookup(feed));
	const readComments = vi.fn(async function* () {
		yield* feed.comments;
	});
	const markTracked = vi.fn(async () => {
		if (feed.failWrite) throw new Error('synthetic provider body');
	});
	const ids = () =>
		['fixture-001', 'fixture-002', 'fixture-003'][runtime.store.maxSeq()] ?? 'fixture-004';
	const runtime: TrackerNativeRuntimeService = new TrackerNativeRuntimeService(database, {
		node,
		role: 'spoke',
		now: () => feed.now,
		adapter: {
			lease: options.lease ?? { owner: node, tryAcquire: () => () => {} },
			provider: { readIssues, readIssue, readTimeline, readComments, markTracked },
			redactText: options.redactText ?? ((text) => text),
			intakePolicy: options.intakePolicy,
			now: () => feed.now,
			itemId: ids,
			hasStarted: () => feed.started
		}
	});
	const { adapter: service, store, items } = runtime;
	seedLegacySource(database);
	return {
		service: service!,
		store,
		items,
		database,
		feed,
		readIssues,
		readTimeline,
		readIssue,
		readComments,
		markTracked
	};
}

function seedLegacySource(database: DatabaseSync): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS adapter_runner(
			slot INTEGER PRIMARY KEY CHECK(slot = 1), node TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS adapter_sources(
			id TEXT PRIMARY KEY, config TEXT NOT NULL, enabled_at INTEGER NOT NULL, cursor INTEGER NOT NULL,
			paused INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, last_run INTEGER, last_error TEXT
		);
		CREATE TABLE IF NOT EXISTS adapter_links(
			source_id TEXT NOT NULL, external_id TEXT NOT NULL, external_key TEXT NOT NULL, item_id TEXT NOT NULL,
			remote_state TEXT, events_after INTEGER NOT NULL, owned INTEGER NOT NULL, sync_pending INTEGER NOT NULL,
			PRIMARY KEY(source_id, external_id)
		);
		CREATE TABLE IF NOT EXISTS adapter_events(
			source_id TEXT NOT NULL, external_id TEXT NOT NULL, event_id TEXT NOT NULL,
			PRIMARY KEY(source_id, external_id, event_id)
		);
	`);
	const config = {
		id: adapterSourceId,
		type: 'github',
		target: 'example/widgets',
		kind: 'task',
		agent: 'fixture',
		project: 'fixture',
		computer: 'auto',
		owner: null,
		model: null,
		auto_launch: 'unlabeled',
		include_labels: [],
		exclude_labels: [],
		enabled_at: adapterEnabledAt
	};
	database
		.prepare(
			`
		INSERT OR IGNORE INTO adapter_sources(id, config, enabled_at, cursor) VALUES (?, ?, ?, ?)
	`
		)
		.run(adapterSourceId, JSON.stringify(config), adapterEnabledAt, adapterEnabledAt);
}

export function sqliteFixtureLease(path: string): TrackerAdapterLease {
	return new TrackerAdapterLeaseAdapter('fixture-owner', path);
}

function fixtureIssueLookup(feed: TrackerAdapterFeed) {
	return async (_source: unknown, number: string) =>
		feed.issues.find((issue) => String(issue.number) === number);
}

export function adapterFollowUpFixture() {
	const fixture = adapterFixture({
		intakePolicy: () => ({
			titlePrefix: 'Fixture Widgets',
			matchesItem: (item) => item.agent === 'fixture',
			instructions: 'Use the normal dev gate.',
			followUp: {
				author: 'fixture-tester',
				instructions: 'Tester-owned. Use Refs #{issue}. Retest after verified live staging.',
				coveredComments: { 104: 'known-item' }
			}
		})
	});
	const comment = seedFollowUpFeed(fixture.feed);
	seedFollowUpWork(fixture.store);
	return { ...fixture, comment };
}

function seedFollowUpFeed(feed: TrackerAdapterFeed) {
	const comment = {
		id: 101,
		body: 'Correction 01: retry still fails',
		issue_url: 'https://api.github.com/repos/example/widgets/issues/17',
		created_at: new Date(5_000).toISOString(),
		user: { type: 'User', login: 'Fixture-Tester' }
	};
	feed.issues = [
		adapterIssue({ created_at: comment.created_at, labels: [{ name: 'already labeled' }] }),
		adapterIssue({ id: 200, number: 18, state: 'closed' }),
		adapterIssue({ id: 300, number: 19, pull_request: {} })
	];
	feed.comments = [
		comment,
		comment,
		{ ...comment, id: 102, body: 'Thanks, it works now! 👍' },
		{ ...comment, id: 103, user: { type: 'User', login: 'example' } },
		{ ...comment, id: 104 },
		{ ...comment, id: 105, issue_url: comment.issue_url.replace('/17', '/18') },
		{ ...comment, id: 106, issue_url: comment.issue_url.replace('/17', '/19') },
		{ ...comment, id: 107, created_at: new Date(feed.now - 8 * 86400_000).toISOString() },
		{ ...comment, id: 108, performed_via_github_app: {} },
		{ ...comment, id: 109, user: { type: 'Bot', login: 'fixture-tester' } }
	];
	return comment;
}

function seedFollowUpWork(store: ReturnType<typeof adapterFixture>['store']) {
	for (const [itemId, description, status] of [
		['original', 'original work', 'done'],
		['known-item', 'known correction', 'in_progress']
	]) {
		store.appendLocal({
			itemId,
			fields: {
				title: `Fixture Widgets #17: ${description}`,
				kind: 'task',
				agent: 'fixture',
				status
			}
		});
	}
}

export function readFollowUpFixtureItems(database: DatabaseSync) {
	return {
		original: database
			.prepare("SELECT status, adapter_instructions FROM items WHERE id = 'original'")
			.get(),
		covered: database.prepare("SELECT status FROM items WHERE id = 'known-item'").get(),
		correction: database
			.prepare(
				"SELECT notes, due, adapter_instructions FROM items WHERE title LIKE '%GitHub comment 101%'"
			)
			.get()
	};
}

export function sourceRun(database: DatabaseSync): unknown {
	return database.prepare('SELECT cursor, last_run, last_error FROM adapter_sources').get();
}
