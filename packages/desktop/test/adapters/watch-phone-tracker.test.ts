import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackerChangeEvent } from '../../../reports/src/lib/projects-sessions/realtime/realtime.types';
import { followTrackerSource } from '../../src/lib/development-tooling/tracker-inbox/followTrackerSource';
import { phoneTrackerInboxSource } from '../../src/lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
import { phoneTrackerTools } from '../../src/lib/verification-evidence/select-environment/phoneTrackerTools';
import type { RemoteNativePlugin } from '../../src/models/development-tooling/Environment.types';
import type { RealtimeState } from '../../../reports/src/lib/projects-sessions/realtime/realtime.types';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function plugin(state: RealtimeState = 'reconnecting') {
	let emit: (event: TrackerChangeEvent) => void = () => undefined;
	const remove = vi.fn(async () => undefined);
	const native = {
		trackerTool: vi.fn(),
		refreshTracker: vi.fn(),
		trackerPush: vi.fn(async () => ({ state })),
		addListener: vi.fn(async (_name: string, listener: typeof emit) => {
			emit = listener;
			return { remove };
		})
	} as unknown as RemoteNativePlugin;
	return { native, remove, emit: (event: TrackerChangeEvent) => emit(event) };
}

const source = (native: RemoteNativePlugin) => phoneTrackerInboxSource(phoneTrackerTools(native)!);

afterEach(() => vi.useRealTimers());

describe('phone tracker pushes', () => {
	it('tells a new listener the current state, then each native event', async () => {
		const phone = plugin('live');
		const heard: TrackerChangeEvent[] = [];
		const stop = source(phone.native).watch!((event) => heard.push(event));
		await settle();
		phone.emit({ state: 'live', changed: true });
		expect(heard).toEqual([
			{ state: 'live', changed: false },
			{ state: 'live', changed: true }
		]);
		stop();
		await settle();
		phone.emit({ state: 'live', changed: true });
		expect(heard).toHaveLength(2);
		expect(phone.remove).toHaveBeenCalledOnce();
	});

	it('does not let a late state answer overwrite a push', async () => {
		const phone = plugin('reconnecting');
		const heard: TrackerChangeEvent[] = [];
		source(phone.native).watch!((event) => heard.push(event));
		phone.emit({ state: 'live', changed: true });
		await settle();
		expect(heard).toEqual([{ state: 'live', changed: true }]);
	});

	it('offers no watch for an app build that cannot push', () => {
		const phone = plugin();
		delete phone.native.trackerPush;
		expect(source(phone.native).watch).toBeUndefined();
	});
});

describe('an inbox following a phone', () => {
	it('re-reads on a change of the copy even while pushes are down', async () => {
		vi.useFakeTimers();
		const phone = plugin('reconnecting');
		const refresh = vi.fn(async () => undefined);
		const states: RealtimeState[] = [];
		const stop = followTrackerSource(source(phone.native), {
			refresh,
			state: (state) => states.push(state)
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).not.toHaveBeenCalled();
		phone.emit({ state: 'reconnecting', changed: true });
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(refresh).toHaveBeenCalledTimes(2);
		phone.emit({ state: 'live', changed: false });
		await vi.advanceTimersByTimeAsync(60_000);
		expect(refresh).toHaveBeenCalledTimes(3);
		expect(states.at(-1)).toBe('live');
		stop();
	});
});
