import { expect, test } from 'vitest';
import type { RemoteNativeStatus } from '../src/models/Environment.types';
import { awakeNote, remoteLabels } from '../src/utils/remoteLabels';

const at = (change: Partial<RemoteNativeStatus>) =>
	({
		state: 'online',
		origin: 'https://relay.example.invalid',
		host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
		device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
		grant: { projects: [], agents: false },
		reason: null,
		lastOnlineAt: null,
		...change
	}) as RemoteNativeStatus;

test('a lock state the computer reported is shown, and an unknown one is never guessed', () => {
	expect(remoteLabels(at({ locked: true })).detail).toBe('Computer locked · awake');
	expect(remoteLabels(at({ locked: false })).detail).toBe('Computer unlocked · awake');
	expect(remoteLabels(at({})).detail).toBe(awakeNote);
	expect(awakeNote).not.toMatch(/Computer (un)?locked/);
});

test('a computer that is not online is never described by a lock state', () => {
	for (const state of ['offline', 'connecting', 'revoked', 'pending-approval'] as const)
		expect(remoteLabels(at({ state, locked: true })).detail).not.toMatch(/locked ·/);
});
