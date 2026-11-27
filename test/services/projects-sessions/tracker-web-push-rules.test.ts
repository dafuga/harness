import { describe, expect, test } from 'vitest';
import { encryptWebPush } from '../../../src/services/projects-sessions/tracker-web-push-service/encryptWebPush';
import { needsYouPushMessage } from '../../../src/services/projects-sessions/tracker-web-push-service/needsYouPushMessage';
import { openPushAsks } from '../../../src/services/projects-sessions/tracker-web-push-service/openPushAsks';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import {
	deliveredPush,
	emptyPushState,
	failedPush,
	planNeedsYouPush,
	quietPushHold
} from '../../../src/services/projects-sessions/tracker-web-push-service/planNeedsYouPush';
import { webPushContract } from '../../../src/utils/projects-sessions/webPushContract';
import { isWebPushEndpoint } from '../../../src/utils/projects-sessions/isWebPushEndpoint';

const minute = 60_000;
const noon = Date.parse('2026-11-26T12:00:00Z');
const bytes = (value: string) => Buffer.from(value, 'base64url');

test('encrypts the RFC 8291 test vector byte for byte', () => {
	const sealed = encryptWebPush(
		Buffer.from('When I grow up, I want to be a watermelon'),
		{
			p256dh:
				'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
			auth: 'BTBZMqHH6r4Tts7J_aSIgg'
		},
		{
			salt: bytes('DGv6ra1nlYgDCS1FRnbzlw'),
			privateKey: bytes('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')
		}
	);
	expect(sealed.toString('base64url')).toBe(
		'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
	);
});

test('a personal or family ask never sends a needs-you notification', () => {
	const flagged = ['harness', 'personal', 'dad', 'family'].map((agent) => ({
		id: `${agent}-item`,
		agent,
		deleted: false,
		sensitive: false,
		needs_daniel: true,
		resolved: false,
		question: 'Book the sample room?',
		options: [
			{ label: 'Yes', effect: '', recommended: true },
			{ label: 'No', effect: '' }
		]
	})) as unknown as TrackerItem[];
	expect(openPushAsks(flagged).map((ask) => ask.itemId)).toEqual(['harness-item']);
});

describe('when to notify', () => {
	const sent = deliveredPush(['a'], noon);

	test('a new decision is due at once and nothing open is never due', () => {
		expect(planNeedsYouPush(['a'], emptyPushState(), noon).due).toBe(true);
		expect(planNeedsYouPush([], sent, noon + 60 * minute).due).toBe(false);
	});

	test('the same open decision repeats at 15 minutes, not before', () => {
		expect(planNeedsYouPush(['a'], sent, noon + 15 * minute - 1).due).toBe(false);
		expect(planNeedsYouPush(['a'], sent, noon + 15 * minute).due).toBe(true);
	});

	test('another new decision is due once a minute has passed since the last send', () => {
		expect(planNeedsYouPush(['a', 'b'], sent, noon + minute - 1).due).toBe(false);
		expect(planNeedsYouPush(['a', 'b'], sent, noon + minute).due).toBe(true);
	});

	test('answering one of two sends nothing new, and asking it again does', () => {
		const both = deliveredPush(['a', 'b'], noon);
		const one = planNeedsYouPush(['a'], both, noon + 2 * minute);
		expect(one.due).toBe(false);
		expect(planNeedsYouPush(['a', 'b'], one.state, noon + 3 * minute).due).toBe(true);
	});

	test('a held send waits for the hold to pass', () => {
		const held = { ...emptyPushState(), holdUntil: noon + minute };
		expect(planNeedsYouPush(['a'], held, noon).due).toBe(false);
		expect(planNeedsYouPush(['a'], held, noon + minute).due).toBe(true);
	});

	test('failures back off from one minute and never past the repeat interval', () => {
		let state = emptyPushState();
		const waits = Array.from({ length: 7 }, () => {
			state = failedPush(state, 'down', noon);
			return (state.holdUntil! - noon) / minute;
		});
		expect(waits).toEqual([1, 2, 4, 8, 15, 15, 15]);
	});
});

describe('quiet hours in Europe/Lisbon', () => {
	const at = (time: string) => Date.parse(time);

	test('holds from 22:00 to 08:00 and releases at 08:00', () => {
		const night = at('2026-11-26T23:30:00Z');
		const held = quietPushHold(emptyPushState(), webPushContract.defaultQuietHours, night);
		expect(held?.holdUntil).toBe(night + 5 * minute);
		const last = at('2026-11-27T07:58:00Z');
		expect(
			quietPushHold(emptyPushState(), webPushContract.defaultQuietHours, last)?.holdUntil
		).toBe(at('2026-11-27T08:00:00Z'));
		for (const open of ['2026-11-27T08:00:00Z', '2026-11-26T21:59:00Z'])
			expect(
				quietPushHold(emptyPushState(), webPushContract.defaultQuietHours, at(open))
			).toBeNull();
	});

	test('follows Lisbon summer time', () => {
		const summer = at('2026-07-10T21:30:00Z');
		expect(
			quietPushHold(emptyPushState(), webPushContract.defaultQuietHours, summer)
		).not.toBeNull();
	});

	test('the setting turns it off or moves it', () => {
		const night = at('2026-11-26T23:30:00Z');
		const off = { ...webPushContract.defaultQuietHours, enabled: false };
		expect(quietPushHold(emptyPushState(), off, night)).toBeNull();
		const later = { enabled: true, start: '00:00', end: '07:00' };
		expect(quietPushHold(emptyPushState(), later, night)).toBeNull();
	});
});

describe('the one summary', () => {
	const ask = (itemId: string, project: string, question: string) => ({
		itemId,
		project,
		question
	});

	test('names the project and question of a single decision and opens that item', () => {
		expect(needsYouPushMessage([ask('item1', 'harbor', 'Deploy now\nor wait?')])).toEqual({
			title: 'harbor needs you',
			body: 'Deploy now or wait?',
			needs: 'item1'
		});
	});

	test('lists three of many, counts the rest and opens the list', () => {
		const asks = ['cos', 'harbor', 'harness', 'rng', 'x'].map((project, index) =>
			ask(`item${index}`, project, `Question ${index} ${'long '.repeat(40)}`)
		);
		const message = needsYouPushMessage(asks);
		expect(message.title).toBe('5 decisions need you');
		expect(message.needs).toBe('all');
		const lines = message.body.split('\n');
		expect(lines).toHaveLength(4);
		expect(lines[0]).toMatch(/^Chief of Staff: Question 0 .*…$/);
		expect(lines.every((line) => line.length <= 90)).toBe(true);
		expect(lines[3]).toBe('+2 more');
	});
});

test('accepts only HTTPS addresses of the known push services', () => {
	for (const good of [
		'https://fcm.googleapis.com/fcm/send/abc',
		'https://web.push.apple.com/Qx',
		'https://updates.push.services.mozilla.com/wpush/v2/abc',
		'https://wns2-par02p.notify.windows.com/w/?token=abc'
	])
		expect(isWebPushEndpoint(good), good).toBe(true);
	for (const bad of [
		'http://fcm.googleapis.com/fcm/send/abc',
		'https://fcm.googleapis.com.evil.test/x',
		'https://evil.test/fcm.googleapis.com',
		'https://user@fcm.googleapis.com/x',
		'https://fcm.googleapis.com:8443/x',
		'https://127.0.0.1/x',
		'https://evilpush.apple.com/x',
		'not a url'
	])
		expect(isWebPushEndpoint(bad), bad).toBe(false);
});
