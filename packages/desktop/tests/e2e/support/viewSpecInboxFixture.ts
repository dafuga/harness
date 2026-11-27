import { DatabaseSync } from 'node:sqlite';
import type { Page } from '../../../../../test/support/browserTest';
import { TrackerItemReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../../src/services/projects-sessions/TrackerPersistenceService';
import { phoneAskAttachments } from '../../../../../src/services/projects-sessions/tracker-phone-replica-service/phoneAskAttachments';
import { MacTrackerInboxService } from '../../../src/lib/development-tooling/desktop-initialization/MacTrackerInboxService';
import { projectFixture } from '../ui-project-fixture';
import { remotePhoneFixture } from '../ui-remote-phone-fixture';
import type { Tracker } from './viewSpecInboxFixture.types';

export const specItem = 'fixturespec';

/** A real in-memory Tracker with one flagged spec review. */
export async function specTracker(markdown: string, title: string) {
	const database = new DatabaseSync(':memory:');
	const now = () => Date.UTC(2026, 10, 21, 12);
	const store = new TrackerPersistenceService(database, 'fixture-mac', { now });
	const items = new TrackerItemReadRepository(database);
	const runs = new TrackerRunReadRepository(database, store.node);
	const api = new TrackerLocalApiService(store, items, { now, runs });
	const fields = { title: 'Fixture spec', project: 'Fixture', status: 'open' };
	store.appendLocal({ itemId: specItem, fields });
	const fetcher = (async (input: string | URL, init?: RequestInit) =>
		api.handle(new Request(String(input), init))) as typeof fetch;
	const flagged = await fetcher(`http://127.0.0.1:7701/items/${specItem}/flag`, {
		method: 'POST',
		body: JSON.stringify({
			question: 'Approve the service spec and start the build?',
			options: [
				{ label: 'Approve', effect: 'Starts the build.', recommended: true },
				{ label: 'Ask for changes', effect: 'The session revises it.' }
			],
			attachments: [{ kind: 'spec', title, pr: Number(process.env.SPEC_PROOF_PR ?? 12), markdown }]
		})
	});
	if (!flagged.ok) throw new Error(await flagged.text());
	return { items, fetcher, close: () => database.close() };
}

/** The Mac page over the real Mac inbox service. */
export async function macSpecPage(page: Page, tracker: Tracker) {
	const service = new MacTrackerInboxService();
	const original = globalThis.fetch;
	globalThis.fetch = tracker.fetcher;
	await projectFixture(page);
	await page.exposeFunction('__inboxRead', (input: object) => service.read(input));
	await page.exposeFunction('__inboxWrite', (input: object) => service.write(input));
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: Record<string, unknown>;
			__inboxRead: (input: object) => Promise<unknown>;
			__inboxWrite: (input: object) => Promise<unknown>;
		};
		const read = host.__inboxRead;
		host.harness.trackerInbox = {
			overview: () => read({ operation: 'overview' }),
			search: (query: string) => read({ operation: 'search', query }),
			detail: (id: string) => read({ operation: 'detail', id }),
			write: (write: object) => host.__inboxWrite(write),
			writes: async () => ({ freshness: 'current', partial: false, value: [] }),
			discard: async () => ({ freshness: 'current', partial: false })
		};
	});
	return () => void (globalThis.fetch = original);
}

/** SYNTHETIC native Tracker tools. The flag and document are what the phone replica carries. */
export async function phoneSpecPage(page: Page, tracker: Tracker, calls: string[]) {
	await remotePhoneFixture(page, 'online');
	await page.exposeFunction('__trackerTool', (input: { name: string }) => {
		calls.push(input.name);
		return phoneReply(tracker, input.name);
	});
	await page.addInitScript(() => {
		const host = window as unknown as {
			__trackerTool: (input: object) => Promise<unknown>;
			Capacitor: {
				PluginHeaders: { name: string; methods: object[] }[];
				nativePromise: (plugin: string, method: string, input: object) => unknown;
			};
		};
		const remote = host.Capacitor.PluginHeaders.find((entry) => entry.name === 'HarnessRemote');
		remote?.methods.push({ name: 'trackerTool', rtype: 'promise' });
		const native = host.Capacitor.nativePromise;
		host.Capacitor.nativePromise = (plugin, method, input) =>
			method === 'trackerTool' ? host.__trackerTool(input) : native(plugin, method, input);
	});
}

function phoneReply(tracker: Tracker, name: string) {
	const item = tracker.items.get(specItem);
	const row = tracker.items.resolve(specItem);
	const header = {
		id: specItem,
		title: item.title,
		project: 'Fixture',
		status: item.status,
		updatedAt: item.updated_at,
		dueAt: null
	};
	const attachments = phoneAskAttachments(row).attachments ?? [];
	const data = {
		tracker_status: {
			counts: {},
			unresolvedFlags: Number(Boolean(item.needs_daniel && !item.resolved)),
			recent: [],
			needsYou:
				item.needs_daniel && !item.resolved
					? [{ ...header, question: item.question, askedAt: item.asked_at }]
					: []
		},
		tracker_show: {
			item: header,
			notes: [],
			runs: [],
			attentionRevision: 'r1',
			flag: {
				state: 'open',
				at: item.asked_at,
				question: item.question,
				options: item.options,
				attachments: attachments.map(({ content: _text, ...listing }) => listing)
			}
		},
		tracker_document: { document: attachments[0]?.content },
		tracker_answer: { intentId: 'fixture-intent', status: 'queued' },
		tracker_write_status: { writes: [] }
	}[name];
	return {
		source: 'local_tracker',
		freshness: 'current',
		lastSyncedAt: null,
		partial: false,
		data
	};
}
