import { expect, test } from 'vitest';
import {
	codeNotice,
	linkNotice,
	nameNotice,
	pairingInput,
	pairingTarget
} from '../../src/utils/pairingInput';

const hostId = 'a1'.repeat(20);
const pairingId = 'b2'.repeat(16);
const relay = 'https://relay.example.invalid';
const link = (origin: string, host = hostId, pairing = pairingId) =>
	`harnessremote://pair?origin=${encodeURIComponent(origin)}&host=${host}&pairing=${pairing}`;
const fields = { link: link(relay), code: 'kq7m-2xwp', deviceName: ' Ada iPhone ' };

test('a pairing link, a typed code and a name become the exact pairing request', () => {
	expect(pairingInput(fields)).toEqual({
		input: { origin: relay, hostId, pairingId, code: 'KQ7M2XWP', deviceName: 'Ada iPhone' }
	});
});

test.each([
	'http://relay.example.invalid',
	'https://localhost:8787',
	'https://127.0.0.1',
	'https://[::1]',
	'https://user@relay.example.invalid',
	'https://relay.example.invalid/path',
	'https://relay.example.invalid/',
	'wss://relay.example.invalid',
	''
])('a relay that is not an exact https origin of another machine is refused: %s', (origin) => {
	expect(pairingInput({ ...fields, link: link(origin) })).toEqual({ error: linkNotice });
});

test('a link of another scheme or with malformed identifiers is refused', () => {
	const refused = [
		`${relay}/pair?host=${hostId}&pairing=${pairingId}`,
		link(relay, hostId.toUpperCase()),
		link(relay, hostId, pairingId.slice(2)),
		'KQ7M-2XWP',
		''
	];
	for (const value of refused)
		expect(pairingInput({ ...fields, link: value })).toEqual({ error: linkNotice });
});

test('the code is normalised, and one outside the alphabet or of another length is refused', () => {
	expect(pairingInput({ ...fields, code: ' kq7m 2xwp ' })).toMatchObject({
		input: { code: 'KQ7M2XWP' }
	});
	for (const code of ['KQ7M', 'KQ7M2XWPA', 'KQ7M2XW0', 'KQ7M2XWI', ''])
		expect(pairingInput({ ...fields, code })).toEqual({ error: codeNotice });
});

test('a phone needs a name of at most eighty characters', () => {
	expect(pairingInput({ ...fields, deviceName: '  ' })).toEqual({ error: nameNotice });
	expect(pairingInput({ ...fields, deviceName: 'a'.repeat(81) })).toEqual({ error: nameNotice });
	expect(pairingInput({ ...fields, deviceName: 'a'.repeat(80) })).toHaveProperty('input');
});

test('a link that carries anything besides its three public identifiers is refused', () => {
	const extra = [`${fields.link}&code=KQ7M2XWP`, `${fields.link}&credential=x`, `${fields.link}#x`];
	for (const value of extra)
		expect(pairingInput({ ...fields, link: value })).toEqual({ error: linkNotice });
	expect(pairingTarget(fields.link)).toEqual({ origin: relay, hostId, pairingId });
	expect(pairingTarget(`${fields.link}&code=KQ7M2XWP`)).toBeNull();
	expect(pairingTarget(link('http://localhost:8787'))).toBeNull();
});

test('a relay on this machine is accepted only when the plugin states a test fixture build', () => {
	const local = link('http://127.0.0.1:8791');
	expect(pairingTarget(local)).toBeNull();
	expect(pairingInput({ ...fields, link: local })).toEqual({ error: linkNotice });
	expect(pairingTarget(local, true)).toEqual({
		origin: 'http://127.0.0.1:8791',
		hostId,
		pairingId
	});
	expect(pairingInput({ ...fields, link: local }, true)).toHaveProperty('input.origin');
	expect(pairingTarget(link('http://relay.example.invalid'), true)).toBeNull();
	expect(pairingTarget(`${local}&code=KQ7M2XWP`, true)).toBeNull();
});
