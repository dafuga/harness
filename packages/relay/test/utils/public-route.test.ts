import { expect, test } from 'vitest';
import { publicRoute } from '../../src/utils/publicRoute';

const hostId = 'a1'.repeat(20);
const pairingId = 'b2'.repeat(16);
const host = `/v1/hosts/${hostId}`;
const pairing = `${host}/pairings/${pairingId}`;

test('publicRoute knows health', () => {
	expect(publicRoute('GET', '/v1/health')).toEqual({ kind: 'health', path: '/v1/health' });
});

test('publicRoute knows the connect route of a host', () => {
	expect(publicRoute('GET', `${host}/connect`)).toEqual({
		kind: 'connect',
		path: `${host}/connect`,
		hostId
	});
});

test('publicRoute knows the four pairing calls', () => {
	expect(publicRoute('GET', pairing)).toEqual({
		kind: 'pairing',
		path: pairing,
		hostId,
		pairingId,
		action: 'info'
	});
	for (const action of ['request', 'poll', 'exchange'] as const) {
		expect(publicRoute('POST', `${pairing}/${action}`)).toEqual({
			kind: 'pairing',
			path: `${pairing}/${action}`,
			hostId,
			pairingId,
			action
		});
	}
});

test('publicRoute refuses a route under another verb', () => {
	const refused: [string, string][] = [
		['POST', '/v1/health'],
		['HEAD', '/v1/health'],
		['POST', `${host}/connect`],
		['POST', pairing],
		['DELETE', pairing],
		['GET', `${pairing}/request`],
		['GET', `${pairing}/poll`],
		['PUT', `${pairing}/exchange`],
		['OPTIONS', `${pairing}/exchange`]
	];
	for (const [method, path] of refused) expect(publicRoute(method, path)).toBeUndefined();
});

test('publicRoute refuses management and every unknown path', () => {
	const paths = [
		'/',
		'/v1',
		'/v1/health/',
		'/manage/register',
		'/manage/summary',
		`${host}/manage/register`,
		`${host}`,
		`${host}/`,
		`${host}/connect/`,
		`${host}/connect/extra`,
		`${host}/pairings`,
		`${pairing}/`,
		`${pairing}/approve`,
		`${pairing}/request/again`,
		`/v2/hosts/${hostId}/connect`,
		`//v1/hosts/${hostId}/connect`
	];
	for (const path of paths) {
		for (const method of ['GET', 'POST']) expect(publicRoute(method, path)).toBeUndefined();
	}
});

test('publicRoute refuses ids of another shape', () => {
	const upper = hostId.toUpperCase();
	expect(publicRoute('GET', `/v1/hosts/${upper}/connect`)).toBeUndefined();
	expect(publicRoute('GET', `/v1/hosts/${hostId.slice(1)}/connect`)).toBeUndefined();
	expect(publicRoute('GET', `/v1/hosts/${hostId}0/connect`)).toBeUndefined();
	expect(publicRoute('GET', `/v1/hosts/${'g'.repeat(40)}/connect`)).toBeUndefined();
	expect(publicRoute('GET', `${host}/pairings/${pairingId}0`)).toBeUndefined();
	expect(publicRoute('GET', `${host}/pairings/${pairingId.toUpperCase()}`)).toBeUndefined();
	expect(publicRoute('POST', `${host}/pairings/..%2f..%2fmanage/request`)).toBeUndefined();
});
