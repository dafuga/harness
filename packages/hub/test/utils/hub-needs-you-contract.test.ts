import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { listedHomeSnapshot } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { MacTrackerInboxService } from '../../../desktop/src/lib/development-tooling/desktop-initialization/MacTrackerInboxService';
import type { InboxOverview } from '../../../desktop/src/models/development-tooling/TrackerInbox.types';
import { phoneReplicaRows } from '../../../../src/services/projects-sessions/tracker-phone-replica-service/phoneReplicaRows';
import type { TrackerDigest } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import { parseHomePayload } from '../../src/routes/api/hub-home/homePayload';
import { mergeHomeSnapshots } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeMerge';
import {
	recordedAt,
	snapshotTracker,
	type SnapshotMoment
} from '../support/needsYouSnapshotTracker';

/** The recorded rows that were real multiple-choice decisions; every other flag is not Daniel's. */
const decisions: Record<SnapshotMoment, string[]> = {
	'before-cleanup': ['snap005', 'snap006', 'snap022', 'snap029', 'snap030', 'snap042'],
	recorded: ['snap042']
};

async function publishedHome(tracker: ReturnType<typeof snapshotTracker>) {
	const sources = await readTrackerSources(tracker.fetcher, true);
	const published = buildHomeSnapshot(sources, noProviders, recordedAt);
	return parseHomePayload(JSON.parse(JSON.stringify(published)));
}

async function surfaces(tracker: ReturnType<typeof snapshotTracker>) {
	const parsed = await publishedHome(tracker);
	// Two linked computers report the same synced items; each decision still shows once.
	const hub = listedHomeSnapshot(mergeHomeSnapshots([parsed, parsed])!);
	const digest = (await (
		await tracker.api.handle(new Request('http://127.0.0.1:7701/digest'))
	).json()) as TrackerDigest;
	vi.stubGlobal('fetch', tracker.fetcher);
	const mac = (await new MacTrackerInboxService().read({ operation: 'overview' }))
		.value as InboxOverview;
	vi.unstubAllGlobals();
	return { hub, digest, mac };
}

const sorted = (ids: string[]) => [...ids].sort();

for (const moment of ['before-cleanup', 'recorded'] as const)
	test(`needs you equals the open structured asks on every surface (${moment})`, async () => {
		const tracker = snapshotTracker(moment);
		try {
			const { hub, digest, mac } = await surfaces(tracker);
			const expected = decisions[moment];
			expect(sorted(hub.openAsks.map((ask) => ask.itemId))).toEqual(expected);
			// Every listed ask is answerable by tap, with one recommendation.
			for (const ask of hub.openAsks) {
				expect(ask.options.length).toBeGreaterThanOrEqual(2);
				expect(ask.options.filter((option) => option.recommended)).toHaveLength(1);
			}
			// No agent claims to need Daniel without a listed ask.
			const needing = [...hub.agents, ...hub.asks].filter((agent) => agent.state === 'needs-you');
			const askingAgents = new Set(hub.openAsks.map((ask) => ask.agentId));
			expect(needing.filter((agent) => !askingAgents.has(agent.id))).toEqual([]);
			expect(sorted(digest.daniel_decisions.map((item) => item.id))).toEqual(expected);
			const macIds = mac.rows.filter((row) => row.bucket === 'needs-you');
			expect(sorted(macIds.map((row) => row.header.id))).toEqual(expected);
			expect(mac.unresolvedFlags).toBe(expected.length);
			// Every other open flag stays visible to Chief of Staff, as a ping or as needing options.
			const forCos = [...digest.pings, ...digest.needs_options];
			expect(forCos.length + digest.daniel_decisions.length).toBe(digest.needs_daniel.length);
			// The phone copy offers choices only on those decisions.
			const phone = phoneReplicaRows(tracker.database, 'fixture-hub', recordedAt).filter(
				(row) => row.flag?.state === 'open' && row.flag.options
			);
			expect(sorted(phone.map((row) => row.id))).toEqual(expected);
			if (moment === 'recorded') await proveClosedDeliveryAlarm(tracker);
		} finally {
			tracker.close();
		}
	});

async function proveClosedDeliveryAlarm(tracker: ReturnType<typeof snapshotTracker>) {
	const itemId = 'sbb0mckfxs';
	tracker.store.appendLocal({
		itemId,
		fields: {
			title: 'Tracker alerts are not reaching Chief of Staff',
			kind: 'reminder',
			status: 'open',
			needs_daniel: 1,
			question: 'Four Tracker alerts have not reached Chief of Staff. What should happen?',
			asked_at: new Date(recordedAt - 60_000).toISOString(),
			options: JSON.stringify([{ label: 'Check CoS', recommended: true }, { label: 'Wait' }])
		}
	});
	const stale = await publishedHome(tracker);
	expect(stale.openAsks?.map((ask) => ask.itemId)).toContain(itemId);
	for (const fields of [
		{ answer: 'CoS reviewed all four alerts.', resolved: 1 },
		{ status: 'done', answer: null, resolved: 0 }
	]) {
		tracker.store.appendLocal({ itemId, fields });
		const current = await publishedHome(tracker);
		const hub = listedHomeSnapshot(mergeHomeSnapshots([stale, current])!);
		expect(
			hub.openAsks.map((ask) => ask.itemId),
			'the stale Mac copy must not revive the alarm'
		).toEqual(['snap042']);
	}
}
