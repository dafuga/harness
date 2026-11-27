import { expect, test } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { sendWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostCos';
import { channelItem, withTrackerCliChannel } from '../../support/trackerCliChannel';

const choices = ['--option', 'Ship=Releases today.', '--option', 'Wait=Holds a day.'];

test('tracker flag is refused without choices and a recommendation', () => {
	for (const extra of [[], choices, ['--recommend', '1']])
		expect(() => nativeTrackerArgs(['flag', 'abc123', 'Ship it?', ...extra])).toThrow(
			/tracker flag needs choices|--recommend needs --option/
		);
});

test('the recommendation is a number or its letter', () => {
	for (const word of ['2', 'B', 'b'])
		expect(
			nativeTrackerArgs(['flag', 'abc123', 'Ship it?', ...choices, '--recommend', word]).request
				.body
		).toMatchObject({ options: [{ label: 'Ship' }, { label: 'Wait', recommended: true }] });
});

test('a message for Chief of Staff needs no choices', () => {
	const { request } = nativeTrackerArgs(['flag', 'abc123', 'CoS: please publish the canvas.']);
	expect(request.body).toMatchObject({ question: 'CoS: please publish the canvas.' });
});

test('tracker block never asks Daniel', () => {
	const { request } = nativeTrackerArgs(['block', 'abc123', 'waiting on d3jma2']);
	expect(request.body).toEqual({ reason: 'waiting on d3jma2', force: undefined });
	expect(() => nativeTrackerArgs(['block', 'abc123', 'waiting', '--needs-daniel'])).toThrow();
});

const outage = 'Production quote check failing {"ok":false,"status":503}';

test('a refused flag is kept on its item and for Chief of Staff, and still fails', () =>
	withTrackerCliChannel(async ({ run, items, inbox }) => {
		for (const extra of [[], choices, ['--recommend', '1'], ['--no-such-option']]) {
			const question = `${outage} ${extra.join(' ')}`;
			const { code, out } = await run('flag', channelItem, question, ...extra);
			expect(code).toBe(1);
			expect(out).toContain('kept for Chief of Staff');
			expect(items.getStored(channelItem).notes_log.at(-1)?.text).toContain(outage);
		}
		for (const [question, reason] of [
			[
				'Tracker refused move-on from this launched run: only Daniel can park or close a next step. May I use the ignore action for this cleanup?',
				'move-on'
			],
			['Which command should I use to close this already approved cleanup?', 'tool or process'],
			['Should I change the next-step record?', 'next-step record']
		]) {
			const { code, out } = await run(
				'flag',
				channelItem,
				question,
				...choices,
				'--recommend',
				'1'
			);
			expect(code, question).toBe(1);
			expect(out).toContain(reason);
			expect(out).toContain('kept for Chief of Staff');
			expect(inbox()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						item_id: channelItem,
						kind: 'flag-refused',
						reason: expect.stringContaining(question)
					})
				])
			);
		}
		expect(items.getStored(channelItem)).toMatchObject({ needs_daniel: false, question: null });
		expect(inbox()).toContainEqual(
			expect.objectContaining({ item_id: channelItem, kind: 'flag-refused' })
		);
	}));

test('a flag the service refuses is kept too', () =>
	withTrackerCliChannel(async ({ run, inbox }) => {
		const { code, out } = await run('flag', 'zzzzzz', outage, ...choices, '--recommend', '1');
		expect(code).toBe(1);
		expect(out).toContain('kept for Chief of Staff');
		expect(inbox()).toMatchObject([{ item_id: 'unknown', kind: 'flag-refused' }]);
		expect(inbox()[0].reason).toContain('zzzzzz');
	}));

test('the duplicate-ask guard cannot lose a monitor message', () =>
	withTrackerCliChannel(async ({ run, store, inbox }) => {
		store.appendLocal({
			itemId: 'monitor002',
			fields: { title: 'Sample monitor target', status: 'open', kind: 'task' }
		});
		const ask = [outage, ...choices, '--recommend', '1'];
		expect((await run('flag', 'monitor002', ...ask)).code).toBe(0);
		const duplicate = await run('flag', channelItem, ...ask);
		expect(duplicate.out).toContain('a similar item is already open');
		expect(duplicate.code).not.toBe(0);
		expect((await run('alert', channelItem, 'Sample channel still failing')).code).toBe(0);
		expect(inbox().map(({ item_id, kind }) => `${item_id}:${kind}`)).toEqual([
			`${channelItem}:flag-refused`,
			`${channelItem}:alert`
		]);
	}));

test('a flag that cannot be kept says nobody has seen it', () =>
	withTrackerCliChannel(async ({ run, offline }) => {
		offline();
		const { code, out } = await run('flag', channelItem, outage);
		expect(code).toBe(1);
		expect(out).toContain('nobody has seen it');
	}));

test('tracker alert reaches Chief of Staff without asking Daniel', () =>
	withTrackerCliChannel(async ({ run, items, inbox }) => {
		const { code, out } = await run('alert', channelItem, outage);
		expect(code).toBe(0);
		expect(out).toContain('Chief of Staff');
		expect(items.getStored(channelItem)).toMatchObject({
			needs_daniel: false,
			question: null,
			status: 'in_progress'
		});
		expect(items.getStored(channelItem).notes_log.at(-1)?.text).toContain(outage);
		expect(inbox()).toMatchObject([{ item_id: channelItem, kind: 'alert', reason: outage }]);
		expect((await run('alert', channelItem)).code).not.toBe(0);
	}));

test('alerts stay in the inbox when their item is finished or missing', () =>
	withTrackerCliChannel(async ({ run, inbox, advance }) => {
		expect((await run('done', channelItem)).code).toBe(0);
		expect((await run('alert', channelItem, 'Sample quote channel failing')).code).toBe(0);
		expect((await run('alert', 'zzzzzz', 'Sample sign channel failing')).code).toBe(0);
		expect((await run('flag', channelItem, 'CoS: sample relay is down.')).code).toBe(0);
		expect(
			inbox()
				.map(({ kind }) => kind)
				.sort()
		).toEqual(['alert', 'alert', 'cos-message']);
		advance(8 * 24 * 60 * 60_000);
		expect(inbox()).toEqual([]);
	}));

test('repeats do not pile up, and different channels do not replace each other', () =>
	withTrackerCliChannel(async ({ run, items, inbox, advance }) => {
		const notes = () => items.getStored(channelItem).notes_log.length;
		await run('alert', channelItem, 'Sample quote channel failing');
		await run('alert', channelItem, 'Sample quote channel failing');
		expect(notes()).toBe(1);
		await run('alert', channelItem, 'Sample sign channel failing');
		expect(inbox()).toHaveLength(2);
		advance(2 * 60 * 60_000);
		await run('alert', channelItem, 'Sample quote channel failing');
		expect(notes()).toBe(3);
		expect(inbox()).toHaveLength(2);
	}));

test('monitor alerts are delivered ahead of a backlog of routine session alerts', () =>
	withTrackerCliChannel(async ({ run, store, inbox }) => {
		const routine = Array.from({ length: 20 }, (_, index) => ({
			id: `routine-${index}`,
			item_id: channelItem,
			host: 'fixture-spoke',
			kind: index % 2 ? 'idle' : 'launch-without-run',
			reason: 'Routine session alert',
			identity: String(index),
			at: index
		}));
		await run('alert', channelItem, 'Sample alert verb');
		await run('flag', channelItem, 'Sample refused flag');
		await run('flag', channelItem, 'CoS: sample message');
		const sent: string[] = [];
		await sendWatchdogAlerts(
			store,
			{
				scan: async () => null,
				nudge: async () => false,
				send: async (batch) => sent.push(...batch.map(({ kind }) => kind)) > 0
			},
			[...routine, ...inbox()],
			new AbortController().signal
		);
		expect(sent.slice(0, 3).sort()).toEqual(['alert', 'cos-message', 'flag-refused']);
	}));
