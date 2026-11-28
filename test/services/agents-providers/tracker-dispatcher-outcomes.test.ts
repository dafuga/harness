import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import {
	dispatcherFixture,
	liveEvidence,
	primary,
	recorded,
	runFixture,
	sampleId,
	started
} from '../../support/trackerDispatcherFixture';

test('a reopened item invalidates the previous verification result and records usage when verification passes', async () => {
	const fixture = dispatcherFixture();
	const { run } = await runFixture(fixture);
	const { service, changeItem, policy } = fixture;
	const monitor = { type: 'monitor', session: 'live', verify: true } as const;
	changeItem({ status: 'done', completionVersion: 'first-completion' });
	const first = recorded(await service.record(sampleId, run, monitor)).run;
	expect(first.state).toBe('verifying');
	changeItem({ status: 'open' });
	expect(await service.record(sampleId, first, { type: 'verified', passed: true })).toMatchObject({
		status: 'ignored'
	});
	const reopened = recorded(await service.record(sampleId, first, monitor)).run;
	expect(reopened.state).toBe('running');
	changeItem({ status: 'done', completionVersion: 'second-completion' });
	const second = recorded(await service.record(sampleId, reopened, monitor)).run;
	expect(await service.record(sampleId, first, { type: 'verified', passed: true })).toMatchObject({
		status: 'ignored'
	});
	changeItem({ completionVersion: 'third-completion' });
	expect(await service.record(sampleId, second, { type: 'verified', passed: true })).toMatchObject({
		status: 'ignored'
	});
	const latest = recorded(await service.record(sampleId, second, monitor)).run;
	const done = recorded(
		await service.record(sampleId, latest, {
			type: 'verified',
			passed: true,
			usage: { input_tokens: 80, output_tokens: 10, cost_usd: 0.03 }
		})
	).run;
	expect(done).toMatchObject({
		outcome: 'done',
		state: 'finished',
		ended_at: policy.now(),
		input_tokens: 80,
		output_tokens: 10,
		cost_usd: 0.03
	});
});

test('verification failure reopens the item and escalates; the eventual success credits the retry', async () => {
	const fixture = dispatcherFixture();
	const { run } = await runFixture(fixture);
	const { service, changeItem, item, runs } = fixture;
	changeItem({ status: 'done' });
	const verifying = recorded(
		await service.record(sampleId, run, { type: 'monitor', session: 'live', verify: true })
	).run;
	const failed = recorded(
		await service.record(sampleId, verifying, {
			type: 'verified',
			passed: false,
			reason: 'fixture tests failed'
		})
	);
	expect(failed.run).toMatchObject({ outcome: 'failed', failure_reason: 'fixture tests failed' });
	expect(item()?.status).toBe('open');
	const reserve = started(await service.prepare(sampleId, failed.retry!));
	expect(reserve.selection).toEqual({
		provider: 'codex',
		model: 'gpt-6.2-sol',
		intelligence: 'xhigh'
	});
	const second = recorded(
		await service.record(sampleId, reserve.run, { type: 'session', session: liveEvidence(reserve) })
	).run;
	changeItem({ status: 'done' });
	expect(
		await service.record(sampleId, second, { type: 'monitor', session: 'live' })
	).toMatchObject({
		status: 'recorded',
		run: { outcome: 'done', attempt: 2, escalated_from: run.id }
	});
	expect(runs()[0].redone_by).toBe('sol');
});

test('a current answer revives only its original live session and preserves the run identity', async () => {
	const fixture = dispatcherFixture({ item: { due: '2026-11-22' } });
	const { run, session } = await runFixture(fixture);
	const { service, item, changeItem, advance, conditions } = fixture;
	changeItem({ status: 'blocked', awaitingAnswer: true, blockedReason: 'fixture needs Daniel' });
	const blocked = recorded(
		await service.record(sampleId, run, { type: 'monitor', session: 'live' })
	).run;
	expect(blocked).toMatchObject({ outcome: 'blocked', state: 'finished' });
	expect(await service.record(sampleId, blocked, { type: 'resume', session })).toMatchObject({
		status: 'ignored'
	});
	changeItem({ answeredCurrentBlock: true, awaitingAnswer: false });
	conditions.activeSessionKeys = [session.key];
	expect(
		await service.record(sampleId, blocked, {
			type: 'resume',
			session: { ...session, state: 'exited' }
		})
	).toMatchObject({ status: 'ignored' });
	expect(
		await service.record(sampleId, blocked, {
			type: 'resume',
			session: { ...session, id: 'other-pane' }
		})
	).toMatchObject({ status: 'ignored' });
	advance(2000);
	expect(await service.record(sampleId, blocked, { type: 'resume', session })).toMatchObject({
		status: 'recorded',
		run: { id: run.id, outcome: null, state: 'running', resumed_at: session.startedAt + 2000 }
	});
	expect(item()).toMatchObject({ status: 'in_progress', blockedReason: null });
});

test('a stalled or over-cap run with a live session stays running and queues no retry', async () => {
	const fixture = dispatcherFixture({
		policy: { defaultEtaMinutes: 3, stallMinutes: 2, maxRunMinutes: 10 }
	});
	const { run } = await runFixture(fixture);
	const { service, advance, changeItem, policy, runs } = fixture;
	const monitor = { type: 'monitor', session: 'live' } as const;
	advance(4 * 60_000);
	changeItem({ updatedAt: policy.now() });
	advance(60_000);
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'run still active'
	});
	advance(2 * 60_000);
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'stalled past its ETA (no activity for over 2 min); its session is still alive'
	});
	advance(4 * 60_000);
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'ran past the 10 min cap; its session is still alive'
	});
	expect(runs()).toEqual([run]);
	expect(
		recorded(await service.record(sampleId, run, { ...monitor, session: 'exited' })).retry
	).toMatchObject({ attempt: 2, escalated_from: run.id });
});

test('missing items preserve active sessions until recovery; closing the linked source abandons cleanly', async () => {
	const fixture = dispatcherFixture();
	const { run } = await runFixture(fixture);
	const { service, removeItem, changeItem } = fixture;
	const monitor = { type: 'monitor', session: 'live' } as const;
	removeItem();
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'item missing'
	});
	changeItem({ id: sampleId, status: 'done', closedBySource: true });
	expect(await service.record(sampleId, run, monitor)).toMatchObject({
		status: 'recorded',
		run: { outcome: 'abandoned', failure_reason: 'linked source closed the item' }
	});
});

test('a pinned model stays pinned when a completed result is rejected', async () => {
	const fixture = dispatcherFixture({
		policy: {
			pickModel: () => ({
				rung: { id: 'sol', cli: 'codex', model: 'gpt-6.2-sol', effort: 'high', pinned: true },
				kind: 'coding',
				reason: 'pin'
			})
		}
	});
	const { run } = await runFixture(fixture);
	const { service, changeItem, item } = fixture;
	changeItem({ status: 'done' });
	const done = recorded(
		await service.record(sampleId, run, { type: 'monitor', session: 'live' })
	).run;
	const rejected = recorded(
		await service.record(sampleId, done, { type: 'reject', reason: '  fixture changes needed  ' })
	);
	expect(rejected.run).toMatchObject({
		outcome: 'rejected',
		failure_reason: 'fixture changes needed',
		node: primary
	});
	expect(rejected.retry).toMatchObject({
		model: run.model,
		effort: run.effort,
		pinned: true,
		escalated_from: run.id
	});
	expect(item()?.status).toBe('open');
});
