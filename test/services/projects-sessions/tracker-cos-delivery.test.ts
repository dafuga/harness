import { expect, test } from 'vitest';
import { withTempDir } from '../../support/temporary';
import {
	completeCosSafetyNotice,
	readCosSafetyNotice
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosDelivery';
import { cosSafetyMessage } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosDeliveryAsk';
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

test('an undelivered routine ask raises one content-free notice after 30 minutes', () =>
	cosDeliveryFixture(({ store, items }) => {
		const waiting = [alert('chief-review', noon - 29 * minute), alert('alert', noon)];
		round(store, waiting, noon);
		expect(readCosSafetyNotice(store)).toBeUndefined();
		round(store, waiting, noon + minute);
		const notice = readCosSafetyNotice(store)!;
		expect(notice).toMatchObject({ count: 2, emergency: false });
		expect(cosSafetyMessage(notice)).toEqual({
			title: "Chief of Staff isn't responding",
			body: '2 asks are waiting',
			needs: 'all'
		});
		expect(alarmAsks(items, noon + minute)).toEqual([]);
		completeCosSafetyNotice(store, notice.generation);
		round(store, waiting, noon + 6 * hour);
		expect(readCosSafetyNotice(store)).toBeUndefined();
		round(store, [], noon + 6 * hour + minute);
		round(store, [alert('chief-review', noon + 5 * hour)], noon + 6 * hour + 2 * minute);
		expect(readCosSafetyNotice(store)?.generation).not.toEqual(notice.generation);
	}));

for (const kind of ['credential exposure: fixture', 'chief-review-emergency'])
	test(`an undelivered ${kind} notice is due after 10 minutes even at night`, () =>
		cosDeliveryFixture(({ store, items }) => {
			const night = noon + 11 * hour;
			const waiting = [alert(kind, night - 9 * minute)];
			round(store, waiting, night);
			expect(readCosSafetyNotice(store)).toBeUndefined();
			round(store, waiting, night + minute);
			expect(readCosSafetyNotice(store)).toMatchObject({ count: 1, emergency: true });
			expect(alarmAsks(items, night + minute)).toEqual([]);
		}));

test('routine asks wait until 08:00 Lisbon and Tracker plumbing stays with Chief of Staff', () =>
	cosDeliveryFixture(({ store }) => {
		const eight = noon - 4 * hour;
		const plumbing = [
			alert('idle', eight - 15 * hour),
			alert('chief-only-review', eight - 15 * hour)
		];
		round(store, plumbing, eight);
		expect(readCosSafetyNotice(store)).toBeUndefined();
		const waiting = [...plumbing, alert('chief-review', eight - 15 * hour)];
		round(store, waiting, eight - minute);
		expect(readCosSafetyNotice(store)).toBeUndefined();
		round(store, waiting, eight);
		expect(readCosSafetyNotice(store)).toMatchObject({ count: 1, emergency: false });
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

test('the hub tick records the notice even when the pane scan is broken', () =>
	cosDeliveryFixture(async ({ store, items }) => {
		store.writeMeta({
			watchdog_alerts: JSON.stringify({ 'worker0001:alert': alert('alert', noon - 2 * hour) })
		});
		await withTempDir('hnt-cos-tick-', async (root) => {
			const watchdog = trackerHostWatchdog(
				store,
				{ chiefOfStaff: true, driver: brokenDriver(root) },
				{ now: () => noon, launch: undefined, slotCap: null }
			);
			await expect(watchdog.tick(new AbortController().signal)).rejects.toThrow();
		});
		expect(alarmAsks(items, noon)).toEqual([]);
		expect(readCosSafetyNotice(store)).toMatchObject({ count: 1 });
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
