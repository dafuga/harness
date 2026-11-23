import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import {
	dispatcherFixture,
	liveEvidence,
	recorded,
	reserveFixture,
	sampleId,
	sampleToken,
	started
} from '../../support/trackerDispatcherFixture';

test('a restarted dispatcher adopts a proven reservation and fences an unrelated session', async () => {
	const fixture = dispatcherFixture();
	const { conditions, policy, service, store, runs } = fixture;
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	conditions.openSession = true;
	expect(await service.claim(sampleId, sampleToken)).toEqual({
		status: 'held',
		reason: 'item already has an open session'
	});
	conditions.openSession = false;
	const reservation = started(await service.claim(sampleId, sampleToken));
	const restarted = new TrackerDispatcherService(store, policy);
	expect(await restarted.claim(sampleId, sampleToken)).toMatchObject({ status: 'held' });
	const session = liveEvidence(reservation);
	expect(
		await restarted.record(sampleId, reservation.run, {
			type: 'session',
			session: { ...session, key: 'unrelated-active-session' }
		})
	).toMatchObject({ status: 'ignored' });
	const proof = { type: 'session', session } as const;
	expect(await restarted.record(sampleId, reservation.run, proof)).toMatchObject({
		status: 'recorded',
		run: { state: 'running', session_id: session.id, started_at: session.startedAt }
	});
	expect(await restarted.record(sampleId, reservation.run, proof)).toMatchObject({
		status: 'ignored'
	});
	expect(runs()).toHaveLength(1);
});

test('an observed exit can recover a session that started and finished before adoption', async () => {
	const fixture = dispatcherFixture();
	const start = await reserveFixture(fixture);
	const { service, changeItem } = fixture;
	changeItem({ status: 'done' });
	const session = { ...liveEvidence(start), state: 'exited' as const };
	const { run } = recorded(await service.record(sampleId, start.run, { type: 'session', session }));
	expect(
		await service.record(sampleId, run, { type: 'monitor', session: 'exited', exitCode: 0 })
	).toMatchObject({
		status: 'recorded',
		run: { state: 'finished', outcome: 'done', session_id: session.id }
	});
});

test('claim and retry results are released only after the receipt transaction commits', async () => {
	const fixture = dispatcherFixture();
	const { service, runs, failure, item, changeItem } = fixture;
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	failure.commit = true;
	await expect(service.claim(sampleId, sampleToken)).rejects.toThrow('injected commit failure');
	expect(runs()).toEqual([]);
	failure.commit = false;
	const { run } = started(await service.claim(sampleId, sampleToken));
	failure.commit = true;
	await expect(
		service.record(sampleId, run, { type: 'startup-failed', reason: 'fixture startup error' })
	).rejects.toThrow('injected commit failure');
	expect(runs()).toEqual([run]);
	expect(item()?.status).toBe('open');
	failure.commit = false;
	const { retry } = recorded(
		await service.record(sampleId, run, { type: 'startup-failed', reason: 'fixture startup error' })
	);
	expect(retry).toMatchObject({
		state: 'queued',
		attempt: 2,
		escalated_from: run.id,
		rung: run.rung
	});
	expect(runs()).toHaveLength(2);
	changeItem({ launch: null });
	expect(await service.prepare(sampleId, retry!)).toMatchObject({
		status: 'recorded',
		run: { id: retry!.id, state: 'finished', outcome: 'abandoned', started_at: null }
	});
	expect(item()).toMatchObject({ status: 'open', launch: null });
});

test('startup retries keep the rung and exhaust atomically when start keeps failing', async () => {
	const fixture = dispatcherFixture();
	const first = await reserveFixture(fixture);
	const { service, item, runs } = fixture;
	const error = { type: 'startup-failed', reason: 'synthetic bad startup', exitCode: 127 } as const;
	const receipt = recorded(await service.record(sampleId, first.run, error));
	expect(receipt.run).toMatchObject({ outcome: 'abandoned', exit_code: 127, started_at: null });
	const retry = receipt.retry!;
	const competing = await Promise.all([
		service.prepare(sampleId, retry),
		service.prepare(sampleId, retry)
	]);
	expect(competing.map(({ status }) => status).sort()).toEqual(['ignored', 'start']);
	const second = started(competing.find(({ status }) => status === 'start')!);
	expect(second.selection).toEqual(first.selection);
	expect(second.key).not.toBe(first.key);
	expect(await service.record(sampleId, second.run, error)).toMatchObject({
		status: 'recorded',
		run: { outcome: 'abandoned', attempt: 2 }
	});
	expect(item()).toMatchObject({
		status: 'blocked',
		awaitingAnswer: true,
		blockedReason: expect.stringContaining('gave up after 2')
	});
	expect(runs()).toHaveLength(2);
});

test('invalid model selections persist an abandoned claim and a block without reserving a runner', async () => {
	const { service, item, policy, runs } = dispatcherFixture({
		policy: { pickModel: () => ({ error: 'invalid fixture model' }) }
	});
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	policy.admit = (_item, _intent, rung) => {
		expect(rung).toBeNull();
		return 'runner capacity exhausted';
	};
	expect(await service.claim(sampleId, sampleToken)).toMatchObject({
		status: 'held',
		reason: 'runner capacity exhausted'
	});
	expect(runs()).toEqual([]);
	policy.admit = () => null;
	expect(await service.claim(sampleId, sampleToken)).toMatchObject({
		status: 'recorded',
		run: { cli: 'none', attempt: 1, state: 'finished', outcome: 'abandoned' }
	});
	expect(item()).toMatchObject({
		status: 'blocked',
		blockedReason: 'auto-launch: invalid fixture model'
	});
	expect(await service.claim(sampleId, sampleToken)).toMatchObject({ status: 'held' });
});
