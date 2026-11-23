import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	noAuthority,
	remoteAuthority,
	authorityChange,
	excludes
} from '../../src/utils/networking-security/remoteAuthority';

const projectId = 'local-3e8a1f6c0d92b47e5a18c3f0d6b9e2471a5c8d0f3b6e9a2c4d7f10b8e5a36c21';
const online: Parameters<typeof remoteAuthority>[0] = {
	state: 'online',
	origin: 'https://relay.example.invalid',
	host: { id: 'host-7c2e9b41', name: 'Office Mac' },
	device: { id: 'device-a41f07d6', name: 'Field iPhone' },
	grant: { projects: [{ id: projectId, name: 'Field Reports' }], comments: true, agents: false },
	reason: null,
	lastOnlineAt: '2026-11-15T09:12:44Z'
};
const offline: Parameters<typeof remoteAuthority>[0] = {
	state: 'offline',
	origin: 'https://relay.example.invalid',
	host: { id: 'host-b06d3e8f', name: 'Office Mac' },
	device: { id: 'device-e5d9a02c', name: 'Field iPhone' },
	grant: null,
	reason: 'The computer is asleep or has no network.',
	lastOnlineAt: '2026-11-14T22:03:10Z'
};

test('identifies the remote holder and serialized grant', () => {
	const authority = remoteAuthority(online);
	const unpaired = remoteAuthority({ ...online, host: null, device: null, grant: null });
	expect(noAuthority).toEqual({ holder: null, grant: '' });
	expect(authority).toEqual({
		holder: 'host-7c2e9b41/device-a41f07d6',
		grant: JSON.stringify(online.grant)
	});
	expect(unpaired).toEqual({ holder: '/', grant: 'null' });
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-authority',
			symbol: 'remoteAuthority',
			state: 'identifies-the-remote-holder-and-serialized-grant',
			evidence: 'examples-cases',
			file: 'identifies-the-remote-holder-and-serialized-grant.json'
		},
		[
			{ name: 'online host and phone with a project grant', input: online, output: authority },
			{
				name: 'unpaired status with no grant',
				input: { ...online, host: null, device: null, grant: null },
				output: unpaired
			}
		]
	);
});

test('classifies authority changes for steady and changed access', () => {
	const known = remoteAuthority(online);
	const same = authorityChange(known, known, true);
	const changedHolder = authorityChange(known, remoteAuthority(offline), false);
	const changedGrant = authorityChange(noAuthority, remoteAuthority(offline), true);
	expect(same).toBe('none');
	expect(changedHolder).toBe('holder');
	expect(changedGrant).toBe('grant');
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-authority',
			symbol: 'authorityChange',
			state: 'classifies-authority-changes-for-steady-and-changed-access',
			evidence: 'examples-cases',
			file: 'classifies-authority-changes-for-steady-and-changed-access.json'
		},
		[
			{
				name: 'steady identical authority',
				input: { known, next: known, steady: true },
				output: same
			},
			{
				name: 'different holder after connection loss',
				input: { known, next: remoteAuthority(offline), steady: false },
				output: changedHolder
			},
			{
				name: 'new authority when none was remembered',
				input: { known: noAuthority, next: remoteAuthority(offline), steady: true },
				output: changedGrant
			}
		]
	);
});

test('checks whether a selected project is outside the grant', () => {
	const present = excludes(online, projectId);
	const absent = excludes(online, 'local-9a0c4e7b');
	const noGrant = excludes(offline, projectId);
	const noSelection = excludes(offline, null);
	expect(present).toBe(false);
	expect(absent).toBe(true);
	expect(noGrant).toBe(true);
	expect(noSelection).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-authority',
			symbol: 'excludes',
			state: 'checks-whether-a-selected-project-is-outside-the-grant',
			evidence: 'examples-cases',
			file: 'checks-whether-a-selected-project-is-outside-the-grant.json'
		},
		[
			{ name: 'project included in grant', input: { status: online, projectId }, output: present },
			{
				name: 'project absent from grant',
				input: { status: online, projectId: 'local-9a0c4e7b' },
				output: absent
			},
			{
				name: 'project checked with no grant',
				input: { status: offline, projectId },
				output: noGrant
			},
			{
				name: 'no selected project',
				input: { status: offline, projectId: null },
				output: noSelection
			}
		]
	);
});

test('Throws TypeError when a required status or authority is null', () => {
	expect(() => remoteAuthority(null as never)).toThrow(TypeError);
	expect(() => authorityChange(null as never, noAuthority, true)).toThrow(TypeError);
	expect(() => authorityChange(noAuthority, null as never, false)).toThrow(TypeError);
	expect(() => excludes(null as never, projectId)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-authority',
			symbol: 'remoteAuthority, authorityChange, excludes',
			state: 'throws-typeerror-when-a-required-status-or-authority-is-null',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-a-required-status-or-authority-is-null.json'
		},
		[
			{
				name: 'null remote status',
				input: { function: 'remoteAuthority', status: null },
				error: 'TypeError'
			},
			{
				name: 'null known authority',
				input: { function: 'authorityChange', known: null, next: noAuthority, steady: true },
				error: 'TypeError'
			},
			{
				name: 'null next authority',
				input: { function: 'authorityChange', known: noAuthority, next: null, steady: false },
				error: 'TypeError'
			},
			{
				name: 'null status for selected project',
				input: { function: 'excludes', status: null, projectId },
				error: 'TypeError'
			}
		]
	);
});
