import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	consolePolicy,
	denyAll,
	type ConsoleRequest,
	type OwnerMode
} from '../../src/utils/explorer-ui/consolePolicy';

// Synthetic addresses: loopback peers, and remote peers from the documentation ranges.
const request = (peer: string | (() => string) | undefined): ConsoleRequest => ({
	request: new Request('http://localhost/harness'),
	url: new URL('http://localhost/harness'),
	...(peer === undefined
		? {}
		: { getClientAddress: typeof peer === 'function' ? peer : () => peer })
});
const state = (name: string) => ({
	unitId: 'function.console-policy',
	symbol: 'consolePolicy',
	state: name,
	evidence: 'examples-cases',
	file: `${name}.json`
});

test('Admits an enabled loopback owner', () => {
	const owner: OwnerMode = { mode: 'loopback', bind: '127.0.0.1' };
	const policy = consolePolicy(owner);
	const cases = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.8.4.2'].map((peer) => ({
		name: `a loopback peer ${peer} on a loopback bind`,
		input: { bind: owner.bind, peer },
		output: policy(request(peer))
	}));
	const live: OwnerMode = { mode: 'loopback', bind: '127.0.0.1' };
	const frozen = consolePolicy(live);
	live.mode = 'off';
	expect(frozen(request('127.0.0.1'))).toBe(true);
	expect(cases.map(({ output }) => output)).toEqual([true, true, true, true]);
	recordExampleCases(state('admits-an-enabled-loopback-owner'), cases);
});

test('Denies disabled owner mode', () => {
	const owners: Array<{ name: string; owner: OwnerMode }> = [
		{ name: 'an owner with no mode', owner: {} },
		{ name: 'mode on instead of loopback', owner: { mode: 'on', bind: '127.0.0.1' } },
		{ name: 'mode Loopback with a different case', owner: { mode: 'Loopback', bind: '127.0.0.1' } },
		{
			name: 'a nonblank address header',
			owner: { mode: 'loopback', bind: '127.0.0.1', addressHeader: 'X-Forwarded-For' }
		}
	];
	const cases = owners.map(({ name, owner }) => ({
		name,
		input: { owner, peer: '127.0.0.1' },
		output: consolePolicy(owner)(request('127.0.0.1'))
	}));
	expect(denyAll(request('127.0.0.1'))).toBe(false);
	expect(cases.map(({ output }) => output)).toEqual([false, false, false, false]);
	recordExampleCases(state('denies-disabled-owner-mode'), cases);
});

test('Denies non-loopback bindings or peers', () => {
	const throwing = () => {
		throw new Error('no socket');
	};
	const rows: Array<{ name: string; bind: string; peer: string | (() => string) | undefined }> = [
		{ name: 'a server bound to all interfaces', bind: '0.0.0.0', peer: '127.0.0.1' },
		{
			name: 'a bind spelled in the long IPv6 loopback form',
			bind: '0:0:0:0:0:0:0:1',
			peer: '127.0.0.1'
		},
		{ name: 'a remote IPv4 peer', bind: '127.0.0.1', peer: '192.0.2.10' },
		{ name: 'a remote IPv4-mapped IPv6 peer', bind: '127.0.0.1', peer: '::ffff:198.51.100.7' },
		{ name: 'a lookalike hostname peer', bind: '127.0.0.1', peer: '127.0.0.1.example.test' },
		{ name: 'an empty peer address', bind: '127.0.0.1', peer: '' },
		{ name: 'no peer address provided', bind: '127.0.0.1', peer: undefined },
		{ name: 'a peer lookup that throws', bind: '127.0.0.1', peer: throwing }
	];
	const cases = rows.map(({ name, bind, peer }) => ({
		name,
		input: { bind, peer: typeof peer === 'function' ? 'throws' : (peer ?? 'not provided') },
		output: consolePolicy({ mode: 'loopback', bind })(request(peer))
	}));
	expect(cases.map(({ output }) => output)).toEqual(cases.map(() => false));
	recordExampleCases(state('denies-non-loopback-bindings-or-peers'), cases);
});
