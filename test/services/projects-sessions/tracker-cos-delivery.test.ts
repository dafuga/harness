import { expect, test } from 'vitest';
import { withTempDir } from '../../support/temporary';
import { sendWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostCos';
import { trackerHostWatchdog } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdog';
import {
	alarmAsks,
	alert,
	brokenDriver,
	cosDeliveryFixture,
	hour,
	minute,
	noon,
	recordedDependencyQueue,
	round
} from '../../support/trackerCosDeliveryFixture';

test('alerts undelivered for over an hour raise one tracker ask that needs no tmux pane', () =>
	cosDeliveryFixture(({ store, items }) => {
		const waiting = [alert('idle', noon - 50 * minute)];
		round(store, waiting, noon);
		expect(alarmAsks(items, noon)).toEqual([]);
		round(store, waiting, noon + 11 * minute);
		round(store, waiting, noon + 12 * minute);
		const asks = alarmAsks(items, noon + 12 * minute);
		expect(asks).toHaveLength(1);
		expect(asks[0].question).toMatch(/^1 Tracker alert has not reached/);
		expect(items.getStored(asks[0].id)).toMatchObject({ priority: 'urgent', kind: 'reminder' });
	}));

for (const kind of [
	'credential exposure: GitHub token',
	'cos-message',
	'urgent-launch-queue-stuck'
])
	test(`an undelivered ${kind} alert is raised at 30 minutes`, () =>
		cosDeliveryFixture(({ store, items }) => {
			round(store, [alert(kind, noon - 29 * minute)], noon);
			expect(alarmAsks(items, noon)).toEqual([]);
			round(store, [alert(kind, noon - 30 * minute)], noon);
			expect(alarmAsks(items, noon)).toHaveLength(1);
		}));

test('time inside the night hold does not count towards the alarm', () =>
	cosDeliveryFixture(({ store, items }) => {
		const overnight = [alert('idle', noon - 15 * hour)];
		const eight = noon - 4 * hour;
		round(store, overnight, eight - 5 * hour);
		round(store, overnight, eight + 59 * minute);
		expect(alarmAsks(items, eight + 59 * minute)).toEqual([]);
		round(store, overnight, eight + 61 * minute);
		expect(alarmAsks(items, eight + 61 * minute)).toHaveLength(1);
	}));

test('the ask closes once delivered, and the same item is reused next time', () =>
	cosDeliveryFixture(({ store, items }) => {
		const waiting = [alert('idle', noon - 2 * hour)];
		round(store, waiting, noon);
		const [first] = alarmAsks(items, noon);
		round(store, [], noon + minute);
		expect(alarmAsks(items, noon + minute)).toEqual([]);
		expect(items.getStored(first.id)).toMatchObject({ status: 'done', needs_daniel: false });
		round(store, waiting, noon + 2 * minute);
		expect(alarmAsks(items, noon + 2 * minute).map(({ id }) => id)).toEqual([first.id]);
	}));

test('an answered ask is raised again only if delivery is still stuck four hours later', () =>
	cosDeliveryFixture(({ store, items }) => {
		const waiting = [alert('idle', noon - 2 * hour)];
		round(store, waiting, noon);
		const [{ id }] = alarmAsks(items, noon);
		store.appendLocal({ itemId: id, fields: { resolved: 1, answer: 'Leave it for now' } });
		round(store, waiting, noon + 3 * hour);
		expect(alarmAsks(items, noon + 3 * hour)).toEqual([]);
		round(store, waiting, noon + 4 * hour + minute);
		expect(alarmAsks(items, noon + 4 * hour + minute)).toHaveLength(1);
	}));

test('a failed send keeps the batch, tells the sender about a backlog and sends security first', () =>
	cosDeliveryFixture(async ({ store }) => {
		const calls: { kinds: string[]; backlog?: boolean }[] = [];
		let accept = false;
		const driver = {
			scan: async () => null,
			nudge: async () => false,
			send: async (
				batch: readonly { kind: string }[],
				_: AbortSignal,
				o?: { backlog: boolean }
			) => {
				calls.push({ kinds: batch.map(({ kind }) => kind), backlog: o?.backlog });
				return accept;
			}
		};
		const waiting = Array.from({ length: 9 }, (_, i) => alert('idle', noon - hour + i));
		waiting.push(alert('credential exposure: GitHub token', noon));
		const signal = new AbortController().signal;
		await sendWatchdogAlerts(store, driver, waiting, signal);
		accept = true;
		await sendWatchdogAlerts(store, driver, waiting, signal);
		await sendWatchdogAlerts(store, driver, waiting, signal);
		expect(calls[0]).toEqual(calls[1]);
		expect(calls[0].kinds[0]).toBe('credential exposure: GitHub token');
		expect(calls.map(({ backlog }) => backlog)).toEqual([true, true, false]);
		expect(calls[2].kinds).toHaveLength(2);
	}));

test('the hub tick raises the ask even when the pane scan is broken', () =>
	cosDeliveryFixture(async ({ store, items }) => {
		store.writeMeta({
			watchdog_alerts: JSON.stringify({ 'worker0001:orphan': alert('orphan', noon - 2 * hour) })
		});
		await withTempDir('hnt-cos-tick-', async (root) => {
			const watchdog = trackerHostWatchdog(
				store,
				{ chiefOfStaff: true, driver: brokenDriver(root) },
				{ now: () => noon, launch: undefined, slotCap: null }
			);
			await expect(watchdog.tick(new AbortController().signal)).rejects.toThrow();
		});
		expect(alarmAsks(items, noon)).toHaveLength(1);
	}, 'daniel-primary-mbp'));

test('recorded dependency updates reach CoS once per item and text change', () =>
	cosDeliveryFixture(async ({ store, items }) => {
		const queue = recordedDependencyQueue();
		const deliveries: string[][] = [];
		const signal = new AbortController().signal;
		const driver = {
			scan: async () => null,
			nudge: async () => false,
			send: async (batch: Readonly<typeof queue>) => {
				deliveries.push(batch.map(({ item_id }) => item_id));
				return true;
			}
		};
		const replay = queue.map((entry) => ({
			...entry,
			id: entry.id + ':requeued',
			at: entry.at + minute
		}));
		const [changed] = replay;
		const reason = changed.reason + ' New blocker text.';
		store.appendLocal({
			itemId: changed.item_id,
			fields: { title: 'Recorded blocker', status: 'blocked', blocked_reason: reason }
		});
		await sendWatchdogAlerts(store, driver, queue, signal);
		await sendWatchdogAlerts(store, driver, [...queue, ...replay], signal);
		await sendWatchdogAlerts(store, driver, replay, signal);
		expect(deliveries).toEqual([queue.map(({ item_id }) => item_id)]);
		await sendWatchdogAlerts(
			store,
			driver,
			[
				{
					...changed,
					id: changed.id + ':changed',
					at: changed.at + minute,
					reason,
					identity: reason
				}
			],
			signal
		);
		await sendWatchdogAlerts(store, driver, queue, signal);
		expect(deliveries).toEqual([queue.map(({ item_id }) => item_id), [changed.item_id]]);
		expect(items.digest(noon).blocked).toContainEqual(
			expect.objectContaining({ id: changed.item_id, blocked_reason: reason })
		);
	}));
