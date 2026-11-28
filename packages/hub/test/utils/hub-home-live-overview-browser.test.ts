import { render } from 'svelte/server';
import HubHomeLive from '../../../reports/src/components/projects-sessions/hub-home/HubHomeLive.svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { HomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLive.types';
import type { OwnerHomeSnapshot } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { liveNotice } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeLive';
import { mergeHomeSnapshots } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeMerge';
import { parseHomePayload } from '../../src/routes/api/hub-home/homePayload';
import {
	LinkedHomeService,
	type LinkedHome
} from '../../src/services/networking-security/LinkedHomeService';
import {
	recordedTracker,
	recordedTrackerFetch,
	type RecordedTracker
} from '../support/recordedTracker';
import { recordedMacAnswer } from '../support/recordedTrackerMac';

let tracker: RecordedTracker;
const now = () => Date.parse(tracker.recordedAt);
const liveRuns = () => tracker.runs.filter((run) => run.ended_at === null);
const itemOf = (id: string) => tracker.items.find((item) => item.id === id)!;

beforeEach(() => {
	tracker = recordedTracker();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(now());
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function expectInitialProjectList(overview: HomeLiveOverview) {
	const html = render(HubHomeLive, { props: { local: overview, now: now() } }).body;
	expect(html).toContain(`See all projects (${overview.projects.length})`);
	for (const project of overview.projects) {
		if (project.running) expect(html).toContain(`>${project.agent}<`);
		else expect(html).not.toContain(`>${project.agent}<`);
	}
	const stopped = { ...overview, projects: overview.projects.map((p) => ({ ...p, running: 0 })) };
	const quiet = render(HubHomeLive, { props: { local: stopped, now: now() } }).body;
	expect(quiet).toContain('No projects have a running session.');
	expect(quiet).not.toContain('class="hh-live-head"');
}

describe('how the browser receives it', () => {
	const api = {
		get: async () => ({ computers: [{ hostId: 'a'.repeat(40), name: 'Mac', online: true }] })
	};
	const linked = (answer: unknown) =>
		new LinkedHomeService(
			api as never,
			'owner',
			() =>
				({
					home: async () => answer,
					close: () => {}
				}) as never
		).read();

	test('the overview arrives from the linked computer, with credentials redacted', async () => {
		const secret = 'ghp_' + 'a'.repeat(36);
		itemOf(liveRuns()[0].item_id).title = `Use ${secret}`;
		const answer = await recordedMacAnswer(tracker);
		answer.liveOverview.projects[0].rows[0].title = `Again ${secret}`;
		const { snapshot } = await linked(answer);

		expect(snapshot?.liveOverview?.projects).toHaveLength(answer.liveOverview.projects.length);
		expect(JSON.stringify(snapshot)).not.toContain(secret);
		expectInitialProjectList(snapshot!.liveOverview!);
	});

	test('an overview this Hub cannot read leaves the rest of Home in place', async () => {
		const answer = await recordedMacAnswer(tracker);
		answer.liveOverview = { projects: 'unreadable' };
		const { snapshot, answered } = await linked(answer);

		expect(answered).toBe(1);
		expect(snapshot?.liveOverview).toBeUndefined();
		expect(snapshot?.agents.length).toBeGreaterThan(0);
	});

	test('two computers give one overview: the one holding the newest Tracker change', async () => {
		const fresh = (await linked(await recordedMacAnswer(tracker))).snapshot!;
		const behind = structuredClone(fresh);
		for (const project of behind.liveOverview!.projects)
			project.updatedAt = '2026-11-20T00:00:00.000Z';
		behind.liveOverview!.readAt = new Date(now() + 5000).toISOString();

		expect(mergeHomeSnapshots([behind, fresh])?.liveOverview).toEqual(fresh.liveOverview);
		expect(mergeHomeSnapshots([fresh, behind])?.liveOverview).toEqual(fresh.liveOverview);
	});

	test('neither the uploaded snapshot nor what the Hub accepts for storage can carry it', async () => {
		const answer = await recordedMacAnswer(tracker);
		const uploaded = buildHomeSnapshot(
			await readTrackerSources(recordedTrackerFetch(tracker), true),
			noProviders,
			now()
		);

		expect(answer.liveOverview.projects.length).toBeGreaterThan(0);
		expect(uploaded).not.toHaveProperty('liveOverview');
		expect(parseHomePayload(answer)).not.toHaveProperty('liveOverview');
	});
});

describe('what the page says when there is nothing to show', () => {
	const reading = (extra: Partial<LinkedHome>): LinkedHome => ({
		linked: 1,
		answered: 1,
		snapshot: null,
		...extra
	});

	test('a failed computer list is not reported as having no linked computer', async () => {
		const service = new LinkedHomeService(
			{
				get: async () => {
					throw new Error('offline');
				}
			} as never,
			'owner'
		);
		const result = await service.read();

		expect(result.unlisted).toBe(true);
		expect(liveNotice(result)).toContain('could not be listed');
	});

	test('loading, unlinked, unanswered and out-of-date computers each say what is true', () => {
		const old = { overview: { status: 'ready' } } as OwnerHomeSnapshot;
		const blind = { overview: { status: 'unavailable' } } as OwnerHomeSnapshot;

		expect(liveNotice(null)).toContain('Reading');
		expect(liveNotice(reading({ linked: 0, answered: 0 }))).toContain('No computer is linked');
		expect(liveNotice(reading({ answered: 0 }))).toContain('nothing here is current');
		expect(liveNotice(reading({ snapshot: old }))).toContain('Update Harness on your Mac');
		expect(liveNotice(reading({ snapshot: blind }))).toContain('could not read Tracker');
	});
});
