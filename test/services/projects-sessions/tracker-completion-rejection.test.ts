import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { withTempRepo } from '../../support/temporary';
import {
	addReviewItem,
	completionReviewFixture,
	markReviewDone,
	reviewItem,
	reviewRequest,
	startReviewRun,
	tickUntil
} from '../../support/trackerCompletionReviewFixture';

vi.setConfig({ testTimeout: 40_000 });

test('rejecting a completed result charges its run, reopens the item and queues a retry', () =>
	withTempRepo(async (repo) => {
		const fixture = completionReviewFixture(repo);
		await startReviewRun(fixture);
		const early = await reviewRequest(fixture.runtime, reviewItem, 'reject');
		expect(early.status).toBe(409);
		markReviewDone(fixture);
		const finishing = await reviewRequest(fixture.runtime, reviewItem, 'reject');
		expect(finishing.status).toBe(409);
		await tickUntil(fixture.tick, () => expect(fixture.runs()[0].outcome).toBe('done'));

		const reply = await reviewRequest(fixture.runtime, reviewItem.slice(0, 6), 'reject', {
			reason: 'wrong approach'
		});
		expect(reply.status).toBe(200);
		expect(await reply.json()).toMatchObject({ status: 'open', rejected_run: { id: 1 } });
		expect(fixture.runs()).toMatchObject([
			{ outcome: 'rejected', failure_reason: 'wrong approach' },
			{ attempt: 2, state: 'queued', escalated_from: 1 }
		]);
		expect(fixture.notes()).toContain('rejected: wrong approach');
	}));

test('rejecting without a local auto-run only reopens; another computer must reject its own', () =>
	withTempRepo(async (repo) => {
		const fixture = completionReviewFixture(repo);
		addReviewItem(fixture);
		markReviewDone(fixture);
		const reply = await reviewRequest(fixture.runtime, reviewItem, 'reject');
		expect(await reply.json()).toMatchObject({ status: 'open', rejected_run: null });
		expect(fixture.notes()).toContain('rejected: rejected by Daniel');

		markReviewDone(fixture);
		fixture.database
			.prepare(
				`INSERT INTO remote_runs(node,id,item_id,attempt,rung,cli,model,state,outcome,queued_at,ended_at)
				VALUES ('harbor-mbp-2',7,?,1,'sol','codex','gpt-6.2-sol','finished','done',1,2)`
			)
			.run(reviewItem);
		const remote = await reviewRequest(fixture.runtime, reviewItem, 'reject');
		expect(remote.status).toBe(409);
		expect((await remote.json()).error).toContain('harbor-mbp-2');
		expect(fixture.item().status).toBe('done');
	}));

test('an item finished by hand credits its failed auto-runs to a human redo', () =>
	withTempRepo(async (repo) => {
		const fixture = completionReviewFixture(repo);
		await startReviewRun(fixture);
		await tickUntil(fixture.tick, () => expect(fixture.runs()[1]?.outcome).toBe('failed'));
		expect(fixture.item().status).toBe('blocked');
		expect(fixture.runs().map((run) => run.redone_by)).toEqual([null, null]);
		markReviewDone(fixture);
		await tickUntil(fixture.tick, () =>
			expect(fixture.runs().map((run) => run.redone_by)).toEqual(['human', 'human'])
		);
	}));
