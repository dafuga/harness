import { expect, test } from 'vitest';
import { relayOrigin, relaySocketUrl } from '../../src/utils/relayOrigin';

const hostId = 'a'.repeat(40);
test('only an exact https origin, or loopback http, is a relay origin', () => {
	expect(relayOrigin('https://relay.example')).toBe('https://relay.example');
	expect(relayOrigin('https://relay.example/')).toBe('https://relay.example');
	expect(relayOrigin('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
	expect(relayOrigin('http://localhost:8787')).toBe('http://localhost:8787');
	const refused = [
		'http://relay.example',
		'https://user:pw@relay.example',
		'https://relay.example/path',
		'https://relay.example?x=1',
		'https://relay.example#fragment',
		'wss://relay.example',
		'relay.example',
		'',
		undefined
	];
	for (const bad of refused) expect(relayOrigin(bad)).toBeNull();
});
test('the socket address names the host and never carries a credential', () => {
	expect(relaySocketUrl('https://relay.example', hostId)).toBe(
		`wss://relay.example/v1/hosts/${hostId}/connect`
	);
	expect(relaySocketUrl('http://127.0.0.1:8787', hostId)).toBe(
		`ws://127.0.0.1:8787/v1/hosts/${hostId}/connect`
	);
	expect(() => relaySocketUrl('http://relay.example', hostId)).toThrow();
	expect(() => relaySocketUrl('https://relay.example', 'nope')).toThrow();
});
