import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { queueIdleWork } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';
import { expect } from '../verificationExpect';
import { dispatcherFixture, runFixture, sampleId, sampleToken } from './trackerDispatcherFixture';

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
