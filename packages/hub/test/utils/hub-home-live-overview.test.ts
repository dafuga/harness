import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { recordedTracker, type RecordedTracker } from '../support/recordedTracker';
import { recordedMacAnswer } from '../support/recordedTrackerMac';

let tracker: RecordedTracker;
const now = () => Date.parse(tracker.recordedAt);

beforeEach(() => {
	tracker = recordedTracker();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(now());
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

async function rows() {
	const answer = await recordedMacAnswer(tracker);
	return (answer.liveOverview?.projects ?? []).flatMap(
		(project: { rows: Record<string, unknown>[] }) => project.rows
	) as Record<string, unknown>[];
}

const liveRuns = () => tracker.runs.filter((run) => run.ended_at === null);
const itemOf = (id: string) => tracker.items.find((item) => item.id === id)!;
const rowOf = async (itemId: string) => (await rows()).find((row) => row.itemId === itemId);

describe('what the linked Mac reports', () => {
	test('every live run of every computer is one row with its recorded facts', async () => {
		const running = (await rows()).filter((row) => row.state === 'running');

		expect(running).toHaveLength(liveRuns().length);
		for (const run of liveRuns()) {
			const item = itemOf(run.item_id);
			expect(running.find((row) => row.itemId === run.item_id)).toMatchObject({
				stage: item.stage,
				status: item.status,
				owner: item.owner,
				computer: run.node,
				model: run.effort ? `${run.model}:${run.effort}` : run.model,
				startedAt: new Date(run.started_at!).toISOString(),
				updatedAt: new Date(item.updated_at).toISOString()
			});
		}
		expect(new Set(running.map((row) => row.computer))).toEqual(
			new Set(['studio-mac', 'travel-mac'])
		);
	});

	test('every Tracker project is listed with its own counts', async () => {
		const answer = await recordedMacAnswer(tracker);
		const projects = answer.liveOverview?.projects ?? [];

		expect(new Set(projects.map((project: { agent: string }) => project.agent))).toEqual(
			new Set(tracker.items.map((item) => item.agent))
		);
		for (const project of projects) {
			const own = tracker.items.filter((item) => item.agent === project.agent);
			expect(project.counts.blocked).toBe(own.filter((item) => item.status === 'blocked').length);
			expect(project.counts.open).toBe(own.filter((item) => item.status === 'open').length);
		}
		expect(answer.liveOverview?.readAt).toBe(tracker.recordedAt);
	});

	test('the stage is the one Tracker records, never one guessed from status', async () => {
		const [first, second] = liveRuns();
		itemOf(first.item_id).stage = 'design';
		itemOf(second.item_id).stage = null;

		expect((await rowOf(first.item_id))?.stage).toBe('design');
		expect((await rowOf(second.item_id))?.stage).toBeNull();
	});
});

describe('what the Mac reports about work that is not simply running', () => {
	test('ended work shows a block or a numbered retry', async () => {
		const live = new Set(liveRuns().map((run) => run.item_id));
		const idle = tracker.items.find((item) => item.status === 'in_progress' && !live.has(item.id))!;
		const waiting = tracker.items.find((item) => item.status === 'open' && !live.has(item.id))!;
		tracker.runs = tracker.runs.filter((run) => ![idle.id, waiting.id].includes(run.item_id));
		idle.status = 'blocked';
		idle.blocked_reason = 'Waiting on Daniel';
		waiting.auto = 'launch-requested';
		tracker.runs.push({
			...liveRuns()[0],
			id: 2000,
			item_id: waiting.id,
			state: 'queued',
			started_at: null,
			queued_at: now()
		});

		expect(await rowOf(idle.id)).toMatchObject({
			state: 'blocked',
			startedAt: null,
			now: 'Blocked: Waiting on Daniel'
		});
		expect(await rowOf(waiting.id)).toMatchObject({ state: 'queued', runId: 2000 });
	});

	test('a run that ended in the last day keeps its recorded outcome', async () => {
		const ended = tracker.runs.find(
			(run) => run.ended_at !== null && !liveRuns().some((live) => live.item_id === run.item_id)
		)!;
		itemOf(ended.item_id).status = 'done';
		ended.ended_at = now() - 60_000;
		ended.outcome = 'timed_out';
		tracker.runs = tracker.runs.filter((run) => run === ended || run.item_id !== ended.item_id);

		expect(await rowOf(ended.item_id)).toMatchObject({ state: 'finished', outcome: 'timed_out' });
		ended.ended_at = now() - 25 * 3_600_000;
		expect(await rowOf(ended.item_id)).toBeUndefined();
	});

	test('a run on an offline computer is not called running', async () => {
		tracker.machines = [{ node: 'travel-mac', status: 'offline' }];
		const travelling = liveRuns().filter((run) => run.node === 'travel-mac');
		const listed = (await rows()).filter((row) => row.state === 'offline');

		expect(travelling.length).toBeGreaterThan(0);
		expect(listed).toHaveLength(travelling.length);
	});

	test('a private item is left out and its live run is only counted', async () => {
		const secret = liveRuns()[0];
		itemOf(secret.item_id).sensitive = true;
		const answer = await recordedMacAnswer(tracker);

		expect(JSON.stringify(answer.liveOverview)).not.toContain(secret.item_id);
		expect(answer.liveOverview?.hiddenRuns).toBe(1);
	});
});
