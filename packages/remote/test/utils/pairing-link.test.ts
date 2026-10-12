import { expect, test } from 'vitest';
import { pairingLink, parsePairingLink } from '../../src/utils/pairingLink';

const hostId = 'a'.repeat(40),
	pairingId = 'b'.repeat(32);
const offer = { origin: 'https://relay.example', hostId, pairingId };
const link = `harnessremote://pair?origin=https%3A%2F%2Frelay.example&host=${hostId}&pairing=${pairingId}`;

test('a link carries public identifiers only and parses back', () => {
	expect(pairingLink(offer)).toBe(link);
	expect(parsePairingLink(link)).toEqual(offer);
	const local = { ...offer, origin: 'http://127.0.0.1:8787' };
	expect(parsePairingLink(pairingLink(local))).toEqual(local);
});
test('links with a code, a credential, another scheme or malformed identifiers are refused', () => {
	const refused = [
		link + '&code=ABCDEFGH',
		link + '&credential=secret',
		link.replace('harnessremote://pair', 'https://pair.example/'),
		link.replace('harnessremote://pair', 'harnessremote://other'),
		link.replace(hostId, 'A'.repeat(40)),
		link.replace(pairingId, 'b'.repeat(31)),
		link.replace('https%3A', 'http%3A'),
		link.replace('&pairing=' + pairingId, ''),
		'not a link',
		''
	];
	for (const bad of refused) expect(parsePairingLink(bad)).toBeNull();
	expect(() => pairingLink({ ...offer, origin: 'http://relay.example' })).toThrow();
	expect(() => pairingLink({ ...offer, hostId: 'nope' })).toThrow();
});
