import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteGrant } from '../../src/lib/verification-evidence/select-environment/capacitor-bridge-adapter/remoteGrant';

const online = {
	state: 'online',
	origin: 'https://relay.example.com',
	host: { id: '5c1e8a3f0d7b94e2a6c10f8e3b59d7a42c6e0f1b', name: 'Studio Mac' },
	device: { id: 'a81e04c7d2f9b36e5041c8a2d7f3e9b0c6d54a12', name: 'Work iPhone' },
	grant: { projects: [{ id: 'local-3a7f0c219e5b4d68c0d2a7f418e6b93cf7a20d5e6b9c31a8d4e07f2b5c8a9e10', name: 'Trail Guide' }], agents: true, comments: true },
	reason: null,
	lastOnlineAt: '2026-11-15T08:12:40Z',
	locked: false
} as Parameters<typeof remoteGrant>[0];

const offline = {
	state: 'offline',
	origin: 'https://relay.example.com',
	host: { id: '5c1e8a3f0d7b94e2a6c10f8e3b59d7a42c6e0f1b', name: 'Studio Mac' },
	device: { id: 'a81e04c7d2f9b36e5041c8a2d7f3e9b0c6d54a12', name: 'Work iPhone' },
	grant: { projects: [{ id: 'local-3a7f0c219e5b4d68c0d2a7f418e6b93cf7a20d5e6b9c31a8d4e07f2b5c8a9e10', name: 'Trail Guide' }], agents: false, comments: false },
	reason: 'The computer is asleep or has no network.',
	lastOnlineAt: '2026-11-15T07:40:05Z'
} as Parameters<typeof remoteGrant>[0];

const state = 'offers-only-attached-methods-for-a-paired-phone';

test('offers only attached methods for a paired phone', () => {
	const attached = [...remoteGrant(online)].sort();
	const grantFallback = [...remoteGrant(offline)].sort();
	const unpaired = remoteGrant({ state: 'unpaired', grant: null } as Parameters<typeof remoteGrant>[0]);
	const expectedAttached = ['addComment', 'approve', 'cancelRun', 'capabilities', 'createPlan', 'entity', 'history', 'image', 'listProjects', 'messages', 'openThread', 'pendingComments', 'providers', 'snapshot', 'source', 'startRun'];

	expect(attached).toEqual(expectedAttached);
	expect(grantFallback).toEqual(['capabilities', 'entity', 'history', 'image', 'listProjects', 'messages', 'pendingComments', 'providers', 'snapshot', 'source']);
	expect(unpaired.size).toBe(0);

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-grant',
			symbol: 'remoteGrant',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{ name: 'online grant offers reads comments and agent operations', input: online, output: attached },
			{ name: 'offline status without methods uses read grant and removes comments and agents', input: offline, output: grantFallback },
			{ name: 'unpaired status offers no methods', input: { state: 'unpaired', grant: null }, output: [...unpaired] }
		]
	);
});
