import { expect, test } from 'vitest';
import { RelayManageAdapter } from '../../src/adapters/RelayManageAdapter';
import type { HubEnv } from '../../src/configs/hubEnvConfig';
import { hubRemote } from '../../src/routes/api/[...path]/hubRemote';
import { remoteHostsFake } from '../support/remoteHostsFake';

const hosts = remoteHostsFake().namespace;
const originOf = (origin?: string, more: Partial<HubEnv> = {}) =>
	hubRemote({ HARNESS_RELAY_ORIGIN: origin, REMOTE_HOSTS: hosts, ...more })?.origin ?? null;

test('the relay origin is the exact origin of the setting', () => {
	expect(originOf('https://relay.example')).toBe('https://relay.example');
	expect(originOf('https://relay.example/')).toBe('https://relay.example');
	expect(originOf('https://relay.example:8443')).toBe('https://relay.example:8443');
	expect(originOf('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
	expect(originOf('http://localhost:8787')).toBe('http://localhost:8787');
});

test('anything but https, or http on this machine, counts as missing', () => {
	const refused = [
		undefined,
		'',
		'relay.example',
		'http://relay.example',
		'http://192.168.1.20:8787',
		'http://127.0.0.1.evil.example',
		'http://localhost.evil.example',
		'http://[::1]:8787',
		'ws://127.0.0.1:8787',
		'wss://relay.example',
		'https://user:secret@relay.example',
		'https://relay.example/v1',
		'https://relay.example/?next=1',
		'https://relay.example/#next',
		'javascript:alert(1)',
		'file:///etc/hosts'
	];
	for (const value of refused) expect([value, originOf(value)]).toEqual([value, null]);
	const production = { HARNESS_ENVIRONMENT: 'production' as const };
	expect(originOf('http://127.0.0.1:8787', production)).toBeNull();
	expect(originOf('http://localhost:8787', production)).toBeNull();
	expect(originOf('https://relay.example', production)).toBe('https://relay.example');
});

test('without a real binding there is no remote part', () => {
	const HARNESS_RELAY_ORIGIN = 'https://relay.example';
	expect(hubRemote({ HARNESS_RELAY_ORIGIN })).toBeNull();
	const named = 'REMOTE_HOSTS' as unknown as DurableObjectNamespace;
	expect(hubRemote({ HARNESS_RELAY_ORIGIN, REMOTE_HOSTS: named })).toBeNull();
	const empty = {} as DurableObjectNamespace;
	expect(hubRemote({ HARNESS_RELAY_ORIGIN, REMOTE_HOSTS: empty })).toBeNull();
	const remote = hubRemote({ HARNESS_RELAY_ORIGIN, REMOTE_HOSTS: hosts });
	expect(remote?.origin).toBe(HARNESS_RELAY_ORIGIN);
	expect(remote?.relay).toBeInstanceOf(RelayManageAdapter);
});
