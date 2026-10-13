import { expect, test } from 'vitest';
import type { RemoteHostStatus, RemoteMobileStatus } from '../../src/models/Environment.types';
import {
	awakeNote,
	grantSummary,
	hostLine,
	hostSummary,
	identityLabel,
	keyLabel,
	relayName,
	remoteLabels,
	timeLeft
} from '../../src/utils/remoteLabels';

const phone = (state: RemoteMobileStatus['state'], reason: string | null = null) =>
	({
		state,
		origin: 'https://relay.example.invalid',
		host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
		device: null,
		grant: null,
		reason,
		lastOnlineAt: null
	}) satisfies RemoteMobileStatus;
const host = (change: Partial<RemoteHostStatus>) =>
	({
		supported: true,
		enabled: true,
		state: 'online',
		reason: null,
		host: null,
		origin: 'https://relay.example.invalid/ignored?x=1',
		pairing: null,
		requests: [],
		devices: [],
		projects: [],
		...change
	}) as RemoteHostStatus;

test('only an online computer is called connected, and its lock state is not invented', () => {
	expect(remoteLabels(phone('online'))).toEqual({
		title: 'Connected to Studio Mac',
		detail: awakeNote
	});
	for (const state of ['offline', 'connecting', 'pairing', 'pending-approval', 'revoked'] as const)
		expect(remoteLabels(phone(state)).title).not.toMatch(/^Connected/);
});

test('a lost computer says why in its own words, and a pending phone names where to approve', () => {
	expect(remoteLabels(phone('offline', 'Suspending')).detail).toBe('Suspending');
	expect(remoteLabels(phone('offline')).title).toBe('Computer offline');
	expect(remoteLabels(phone('pending-approval')).title).toBe('Waiting for approval on Studio Mac…');
	expect(remoteLabels({ ...phone('pending-approval'), host: null }).title).toContain(
		'your computer'
	);
});

test('codes, key identities and relays are shown in a form a person can compare', () => {
	expect([240_000, 65_000, 999, 0, -5].map(timeLeft)).toEqual([
		'4:00',
		'1:05',
		'0:01',
		'0:00',
		'0:00'
	]);
	expect(keyLabel('4f2a91c07b3e' + 'd'.repeat(28))).toBe('4f2a 91c0 7b3e');
	expect(relayName('https://relay.example.invalid/path')).toBe('relay.example.invalid');
	expect(relayName(null)).toBe('');
});

test('the desktop states its relay, its progress and how many phones are approved', () => {
	expect(hostLine(host({}))).toBe('Phone access is on · relay.example.invalid');
	expect(hostLine(host({ state: 'offline' }))).toContain('relay unreachable');
	expect(hostSummary(host({ enabled: false }))).toBe('Phone access off');
	expect(hostSummary(host({}))).toBe('Phone access on · no phone');
	const devices = [{}, {}] as RemoteHostStatus['devices'];
	expect(hostSummary(host({ devices }))).toBe('Phone access on · 2 phones');
	expect(grantSummary({ projects: [{}], agents: false })).toBe('1 project · Read and comment only');
	expect(grantSummary({ projects: [{}, {}], agents: true })).toBe(
		'2 projects · Plan and Change allowed'
	);
});

test('a whole device identity is shown in groups, so that it can be compared on both screens', () => {
	const id = '4f2a91c07b3e' + 'd'.repeat(28);
	expect(identityLabel(id)).toBe('4f2a 91c0 7b3e dddd dddd dddd dddd dddd dddd dddd');
	expect(identityLabel(id).replaceAll(' ', '')).toBe(id);
	expect(identityLabel(id).startsWith(keyLabel(id))).toBe(true);
	expect(identityLabel('')).toBe('');
});
