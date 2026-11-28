import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { queueIdleWork } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';
import { expect } from '../verificationExpect';
import {
	dispatcherFixture,
	recorded,
	runFixture,
	sampleId,
	sampleToken,
	started
} from './trackerDispatcherFixture';

export async function verifyStartedRecoveryBeforeDue() {
	const fixture = dispatcherFixture({ item: { due: '2026-11-22' } });
	const { service, changeItem, writeRun, policy, runs } = fixture;
	const { run } = await runFixture(fixture);
	changeItem({ status: 'in_progress' });
	writeRun({ ...run, state: 'finished', outcome: 'abandoned', ended_at: policy.now() });
	const token = 'resume-owned-work';
	const recovery = await service.request(sampleId, {
		source: 'recovery',
		token,
		expectedAuto: sampleToken
	});
	expect(recovery, JSON.stringify(recovery)).toMatchObject({
		status: 'requested',
		intent: { source: 'recovery', token }
	});
	expect(await service.prepare(sampleId, runs().at(-1)!)).toMatchObject({ status: 'start' });
}

export async function verifyRetryHeldUntilDue() {
	const failed = { type: 'startup-failed', reason: 'synthetic bad startup' } as const;
	const attempt = async (status: 'open' | 'in_progress') => {
		const fixture = dispatcherFixture({ item: { due: '2026-11-22', status } });
		await fixture.service.request(sampleId, { source: 'manual', token: sampleToken });
		const { run } = started(await fixture.service.claim(sampleId, sampleToken));
		const { retry } = recorded(await fixture.service.record(sampleId, run, failed));
		return { ...fixture, retry };
	};
	const { service, changeItem, runs, retry } = await attempt('open');
	expect(retry, 'a future due time must keep the retry').toMatchObject({ state: 'queued' });
	expect(await service.prepare(sampleId, retry!)).toEqual({
		status: 'held',
		reason: 'item is not due'
	});
	changeItem({ due: '2026-11-20' });
	expect(await service.prepare(sampleId, runs().at(-1)!)).toMatchObject({ status: 'start' });
	// Started work is continued by recovery, which a queued retry would block until the due time.
	expect((await attempt('in_progress')).retry).toBeUndefined();
}

export async function sweepIdleWork(
	runtime: TrackerNativeRuntimeService,
	id: string,
	signal: AbortSignal
) {
	const items = new TrackerItemReadRepository(runtime.store.database, runtime.now);
	await queueIdleWork(
		runtime.store,
		{
			rows: items.list({ status: 'all', limit: -1 }),
			snapshot: { host: runtime.store.node, now: runtime.now(), panes: [], items: [], runs: [] },
			dispatch: runtime.dispatch!,
			minutes: 120
		},
		signal
	);
	return items.getStored(id).auto;
}
