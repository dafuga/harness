import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import { followDoorbell } from '$reports/lib/projects-sessions/realtime/followDoorbell';
import type {
	DoorbellSocket,
	TrackerChangeEvent
} from '$reports/lib/projects-sessions/realtime/realtime.types';
import { followTrackerSource } from '../../src/lib/development-tooling/tracker-inbox/followTrackerSource';
import type { TrackerInboxSource } from '../../src/models/development-tooling/TrackerInbox.types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function sockets() {
	const opened: (DoorbellSocket & { sent: string[]; closed: boolean })[] = [];
	const open = () => {
		const socket = {
			onopen: null,
			onmessage: null,
			onclose: null,
			onerror: null,
			sent: [] as string[],
			closed: false,
			send(text: string) {
				this.sent.push(text);
			},
			close() {
				this.closed = true;
			}
		} as DoorbellSocket & { sent: string[]; closed: boolean };
		opened.push(socket);
		return socket;
	};
	return { opened, open };
}

function doorbell() {
	const wire = sockets();
	const heard: string[] = [];
	const bell = followDoorbell({
		open: wire.open,
		onChange: (topic) => heard.push(topic),
		onState: (state) => heard.push(state),
		pingMs: 1000,
		retryMs: 100
	});
	return { ...wire, heard, bell };
}

describe('followDoorbell', () => {
	it('catches up on every connect and passes on only change notices', async () => {
		const { opened, heard, bell } = doorbell();
		await vi.advanceTimersByTimeAsync(0);
		opened[0].onopen?.();
		opened[0].onmessage?.({ data: 'pong' });
		opened[0].onmessage?.({ data: '{"t":"enroll","id":"x"}' });
		opened[0].onmessage?.({ data: '{"t":"changed","topic":"home"}' });
		expect(heard).toEqual(['live', 'resync', 'home']);
		opened[0].onclose?.();
		await vi.advanceTimersByTimeAsync(100);
		opened[1].onopen?.();
		expect(heard.slice(3)).toEqual(['reconnecting', 'live', 'resync']);
		bell.stop();
	});

	it('drops a socket that stops answering although it never closes', async () => {
		const { opened, heard, bell } = doorbell();
		await vi.advanceTimersByTimeAsync(0);
		opened[0].onopen?.();
		await vi.advanceTimersByTimeAsync(2000);
		expect(opened[0].sent).toEqual(['ping']);
		expect(opened[0].closed).toBe(true);
		expect(heard.at(-1)).toBe('reconnecting');
		bell.stop();
	});

	it('backs off while it cannot connect and stops for good', async () => {
		const { opened, bell } = doorbell();
		await vi.advanceTimersByTimeAsync(0);
		opened[0].onclose?.();
		await vi.advanceTimersByTimeAsync(100);
		opened[1].onclose?.();
		await vi.advanceTimersByTimeAsync(199);
		expect(opened).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(opened).toHaveLength(3);
		bell.stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(opened).toHaveLength(3);
	});
});

describe('coalesced', () => {
	it('runs one flight and one more for everything asked during it', async () => {
		const releases: (() => void)[] = [];
		const run = coalesced(() => new Promise<void>((resolve) => releases.push(resolve)));
		void run();
		void run();
		const last = run();
		expect(releases).toHaveLength(1);
		releases[0]();
		await vi.advanceTimersByTimeAsync(0);
		expect(releases).toHaveLength(2);
		releases[1]();
		await last;
		expect(releases).toHaveLength(2);
	});
});

describe('followTrackerSource', () => {
	it('reads on each push and polls only while the link is down', async () => {
		let push: (event: TrackerChangeEvent) => void = () => {};
		const source = {
			watch: (listener: typeof push) => ((push = listener), () => {})
		} as unknown as TrackerInboxSource;
		const refresh = vi.fn(async () => {});
		const stop = followTrackerSource(source, { refresh, state: () => {} }, 1000);
		await vi.advanceTimersByTimeAsync(5000);
		expect(refresh).toHaveBeenCalledTimes(0);
		push({ state: 'live', changed: false });
		await vi.advanceTimersByTimeAsync(5000);
		expect(refresh).toHaveBeenCalledTimes(1);
		push({ state: 'reconnecting', changed: false });
		await vi.advanceTimersByTimeAsync(3000);
		expect(refresh).toHaveBeenCalledTimes(4);
		push({ state: 'live', changed: true });
		await vi.advanceTimersByTimeAsync(5000);
		expect(refresh).toHaveBeenCalledTimes(5);
		stop();
	});
});
