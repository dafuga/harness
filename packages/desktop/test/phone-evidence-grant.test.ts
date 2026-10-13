import { expect, test } from 'vitest';
import { readMethods } from '../../remote/src/models/Remote.types';
import type { RemoteMethod, RemoteNativeStatus } from '../src/models/Environment.types';
import { remoteGrant } from '../src/utils/remoteGrant';

const at = (state: RemoteNativeStatus['state'], change: Partial<RemoteNativeStatus> = {}) =>
	({
		state,
		origin: 'https://relay.example.invalid',
		host: { id: 'a'.repeat(40), name: 'Studio Mac' },
		device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
		grant: { projects: [{ id: 'local-1', name: 'One' }], agents: false },
		reason: null,
		lastOnlineAt: null,
		...change
	}) as RemoteNativeStatus;
const recorded = ['evidence', 'artifact'];
const offered = (status: RemoteNativeStatus | null) =>
	recorded.filter((method) => remoteGrant(status).has(method));
const reader: RemoteMethod[] = ['listProjects', 'snapshot', 'entity'];

test('recorded evidence is offered when the computer attached it, also while it is away', () => {
	const methods: RemoteMethod[] = [...reader, 'evidence', 'artifact'];
	for (const state of ['online', 'offline', 'connecting'] as const)
		expect(offered(at(state, { methods }))).toEqual(recorded);
	expect(offered(at('online', { methods: [...reader, 'artifact'] }))).toEqual(['artifact']);
});

test('an attachment that leaves it out offers none, whatever the grant says', () => {
	const grant = { projects: [{ id: 'local-1', name: 'One' }], agents: true };
	expect(offered(at('online', { methods: reader, grant }))).toEqual([]);
	expect(offered(at('online', { methods: [], grant }))).toEqual([]);
});

test('a grant alone never offers recorded evidence: only an attachment says a computer serves it', () => {
	for (const agents of [false, true]) {
		const grant = { projects: [{ id: 'local-1', name: 'One' }], agents };
		const assumed = remoteGrant(at('online', { grant }));
		expect(offered(at('online', { grant }))).toEqual([]);
		const others = readMethods.filter((method) => !recorded.includes(method));
		expect(others.filter((method) => !assumed.has(method))).toEqual([]);
	}
});

test('a phone that is not paired, or no longer, is offered none', () => {
	const methods: RemoteMethod[] = [...reader, 'evidence', 'artifact'];
	for (const state of ['unpaired', 'pairing', 'pending-approval', 'revoked'] as const)
		expect(offered(at(state, { methods }))).toEqual([]);
	expect(offered(at('online', { methods, grant: null }))).toEqual([]);
	expect(offered(null)).toEqual([]);
});
