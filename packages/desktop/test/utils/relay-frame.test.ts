import { expect, test } from 'vitest';
import { relayFrame } from '../../src/services/relay-link-service/relayFrame';

const deviceId = 'd'.repeat(40),
	connectionId = 'c'.repeat(32),
	text = (value: unknown) => JSON.stringify(value);
const sealed = { type: 'sealed', counter: 0, more: false, data: 'A'.repeat(32) };
const frames = [
	{ type: 'ready', hostId: 'a'.repeat(40), devices: [{ deviceId, online: true }] },
	{ type: 'device-open', deviceId, connectionId },
	{ type: 'device-close', deviceId, connectionId },
	{ type: 'packet', deviceId, connectionId, packet: sealed },
	{
		type: 'pairing-request',
		pairingId: 'b'.repeat(32),
		ephemeralKey: 'K'.repeat(87),
		sealed: 'S'.repeat(64),
		challenge: 'C'.repeat(43)
	},
	{ type: 'device-revoked', deviceId },
	{ type: 'ack', ref: 'r1', ok: false, error: 'not-found' }
];

test('the seven frames of a relay are accepted', () => {
	for (const frame of frames) expect(relayFrame(text(frame))).toEqual(frame);
});
test('anything else is nothing', () => {
	const refused = [
		'not json',
		'[]',
		'null',
		text({ type: 'shell', command: 'id' }),
		text({ type: 'device-open', deviceId: 'nope', connectionId }),
		text({ type: 'device-open', deviceId }),
		text({ type: 'packet', deviceId, connectionId, packet: { type: 'request' } }),
		text({ type: 'packet', deviceId, connectionId, packet: { ...sealed, extra: 1 } }),
		text({ type: 'pairing-request', pairingId: 'b'.repeat(32) }),
		text({ type: 'ack', ref: 5, ok: true }),
		text({ type: 'ready', hostId: 'a'.repeat(40) }),
		'x'.repeat(600000)
	];
	for (const frame of refused) expect(relayFrame(frame)).toBeNull();
});
