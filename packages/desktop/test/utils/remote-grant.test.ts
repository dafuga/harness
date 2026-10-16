import { expect, test } from 'vitest';
import { agentMethods, commentMethods } from '../../../remote/src/models/Remote.types';
import type { RemoteNativeStatus } from '../../src/models/Environment.types';
import { remoteGrant } from '../../src/utils/remoteGrant';

const at = (state: RemoteNativeStatus['state'], change: Partial<RemoteNativeStatus> = {}) =>
	({
		state,
		origin: 'https://relay.example.invalid',
		host: { id: 'a'.repeat(40), name: 'Studio Mac' },
		device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
		grant: { projects: [], agents: false },
		reason: null,
		lastOnlineAt: null,
		...change
	}) as RemoteNativeStatus;
/** Taken from the published lists, so a method that moves between them moves here too. */
const agents: readonly string[] = agentMethods;

test('the methods the computer attached are the only ones offered, and never a desktop one', () => {
	const methods = ['session.attach', 'listProjects', 'snapshot', 'openProject', 'remote.enable'];
	const granted = remoteGrant(at('online', { methods: [...methods, 'startRun'] } as never));
	expect([...granted].sort()).toEqual(['listProjects', 'snapshot', 'startRun']);
});

test('an empty attachment offers nothing, whatever the grant says', () => {
	const grant = { projects: [], agents: true };
	expect(remoteGrant(at('online', { methods: [], grant })).size).toBe(0);
});

test('without attached methods the grant decides, and agents only when it says so', () => {
	const reader = remoteGrant(at('online'));
	expect(reader.has('snapshot') && reader.has('image')).toBe(true);
	for (const method of commentMethods) expect(reader.has(method)).toBe(true);
	for (const method of agents) expect(reader.has(method)).toBe(false);
	const agent = remoteGrant(at('offline', { grant: { projects: [], agents: true } }));
	for (const method of agents) expect(agent.has(method)).toBe(true);
	expect(agent.has('openProject')).toBe(false);
});

test('a phone that is not paired, or no longer, is offered nothing', () => {
	for (const state of ['unpaired', 'pairing', 'pending-approval', 'revoked'] as const)
		expect(remoteGrant(at(state, { methods: ['snapshot'] })).size).toBe(0);
	expect(remoteGrant(null).size).toBe(0);
	expect(remoteGrant(at('online', { grant: null })).size).toBe(0);
});
