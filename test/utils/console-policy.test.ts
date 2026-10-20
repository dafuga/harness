import { expect, test } from 'vitest';
import {
	consolePolicy,
	loopbackAddress
} from '../../packages/reports/src/utils/console-server/consolePolicy';
import { denyAll } from '../../src/utils/consolePolicy';

const event = (peer: string | undefined, headers: Record<string, string> = {}) => ({
	request: new Request('http://localhost/harness', { headers }),
	url: new URL('http://localhost/harness'),
	...(peer === undefined ? {} : { getClientAddress: () => peer })
});
const owner = { mode: 'loopback', bind: '127.0.0.1' };

test('consolePolicy admits only a loopback peer of a server explicitly bound to loopback', async () => {
	const policy = consolePolicy(owner);
	for (const peer of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.8.4.2']) {
		expect([peer, await policy(event(peer))]).toEqual([peer, true]);
	}
	for (const peer of ['192.168.1.20', '10.0.0.5', '::ffff:10.0.0.5', '2001:db8::1', '']) {
		expect([peer, await policy(event(peer))]).toEqual([peer, false]);
	}
	expect(await policy(event(undefined))).toBe(false);
});

test('consolePolicy ignores every header a client can write', async () => {
	const spoofed = { host: '127.0.0.1', 'x-forwarded-for': '127.0.0.1', forwarded: 'for=127.0.0.1' };
	expect(await consolePolicy(owner)(event('203.0.113.9', spoofed))).toBe(false);
});

test('consolePolicy is off unless owner mode, a loopback bind and a real peer address all hold', async () => {
	const local = event('127.0.0.1');
	expect(await consolePolicy({})(local)).toBe(false);
	expect(await consolePolicy({ mode: 'loopback' })(local)).toBe(false);
	expect(await consolePolicy({ mode: 'loopback', bind: '0.0.0.0' })(local)).toBe(false);
	expect(await consolePolicy({ mode: 'on', bind: '127.0.0.1' })(local)).toBe(false);
	expect(await consolePolicy({ ...owner, addressHeader: 'x-forwarded-for' })(local)).toBe(false);
	expect(await denyAll(local)).toBe(false);
	const throwing = {
		...local,
		getClientAddress: () => {
			throw new Error('no socket');
		}
	};
	expect(await consolePolicy(owner)(throwing)).toBe(false);
	expect([loopbackAddress('localhost'), loopbackAddress('127.0.0.1.evil.example')]).toEqual([
		true,
		false
	]);
});
