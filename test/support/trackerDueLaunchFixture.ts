import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { queueIdleWork } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';
import { expect } from '../verificationExpect';
import { nativeTrackerArgs } from '../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

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

export async function verifyNeverAutoLaunch(
	runtime: TrackerNativeRuntimeService,
	id: string,
	action: 'set' | 'clear'
) {
	const args = action === 'set' ? ['unlaunch', id, '--never'] : ['launch', 'on', id];
	const { path, method } = nativeTrackerArgs(args).request;
	const response = await runtime.items.handle(
		new Request(`http://tracker-fixture.invalid${path}`, { method })
	);
	expect(response.status).toBe(200);
	const item = await response.json();
	expect(item).toMatchObject({ kind: 'task', schedule_off: action === 'set' });
	if (action === 'set') {
		expect(item).not.toHaveProperty('next_step');
		expect(item.schedule_hold).toEqual({ reason: 'Never auto-launch', until: null });
	}
}

export function trackerDueLaunchAction(
	runtime: TrackerNativeRuntimeService,
	id: string,
	verb: string
) {
	return runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${id}/${verb}`, {
			method: 'POST',
			body: '{}'
		})
	);
}
