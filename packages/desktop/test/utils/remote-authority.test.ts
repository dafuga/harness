import { expect, test } from 'vitest';
import type { RemoteMobileStatus } from '../../src/models/Environment.types';
import {
	authorityChange,
	excludes,
	noAuthority,
	remoteAuthority
} from '../../src/utils/remoteAuthority';

const grant = { projects: [{ id: 'local-1', name: 'One' }], agents: true };
const online = (change: Partial<RemoteMobileStatus> = {}) =>
	({
		state: 'online',
		origin: 'https://relay.example.invalid',
		host: { id: 'a'.repeat(40), name: 'Studio Mac' },
		device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
		grant,
		reason: null,
		lastOnlineAt: null,
		...change
	}) satisfies RemoteMobileStatus;

test('the same computer, phone and grant change nothing while the phone stays online', () => {
	const known = remoteAuthority(online());
	expect(authorityChange(known, remoteAuthority(online()), true)).toBe('none');
	expect(authorityChange(known, remoteAuthority(online()), false)).toBe('grant');
	expect(authorityChange(noAuthority, known, false)).toBe('grant');
});

test('another computer or another phone ends every view, whatever the grant', () => {
	const known = remoteAuthority(online());
	const host = remoteAuthority(online({ host: { id: 'b'.repeat(40), name: 'Studio Mac' } }));
	const device = remoteAuthority(online({ device: { id: 'e'.repeat(40), name: 'Ada iPhone' } }));
	expect(authorityChange(known, host, true)).toBe('holder');
	expect(authorityChange(known, device, false)).toBe('holder');
});

test('a changed grant is a change, and a project outside it is excluded', () => {
	const known = remoteAuthority(online());
	const reader = online({ grant: { ...grant, agents: false } });
	expect(authorityChange(known, remoteAuthority(reader), true)).toBe('grant');
	expect(excludes(online(), 'local-1')).toBe(false);
	expect(excludes(online(), 'local-2')).toBe(true);
	expect(excludes(online({ grant: null }), 'local-1')).toBe(true);
	expect(excludes(online(), null)).toBe(false);
});
