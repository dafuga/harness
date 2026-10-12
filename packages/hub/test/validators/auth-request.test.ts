import { expect, test } from 'vitest';
import { AuthFailure } from '../../src/utils/authFail';
import { AuthRequestValidator } from '../../src/validators/AuthRequestValidator';

const input = new AuthRequestValidator();
const opaque = 'a'.repeat(43);
const invalid = (run: () => unknown) => expect(run).toThrow(AuthFailure);

test('AuthRequestValidator accepts a compact credential and an opaque CSRF value', () => {
	const body = { credential: 'aa.bb.cc', csrf: opaque, extra: 'ignored' };
	expect(input.google(body)).toEqual({ credential: 'aa.bb.cc', csrf: opaque });
	invalid(() => input.google({ credential: 'aa.bb', csrf: opaque }));
	invalid(() => input.google({ credential: 'aa.bb.cc', csrf: 'short' }));
	invalid(() => input.google({ credential: `${'a'.repeat(5000)}.b.c`, csrf: opaque }));
	invalid(() => input.google({ credential: ['aa.bb.cc'], csrf: opaque }));
});

test('AuthRequestValidator takes an S256 challenge and a bounded resource', () => {
	const start = { challenge: opaque, nonce: 'n'.repeat(22), resource: 'project:p-1' };
	expect(input.nativeStart(start)).toEqual(start);
	expect(input.nativeStart({ ...start, resource: 'projects' }).resource).toBe('projects');
	invalid(() => input.nativeStart({ ...start, challenge: 'a'.repeat(42) }));
	invalid(() => input.nativeStart({ ...start, nonce: 'short' }));
	invalid(() => input.nativeStart({ ...start, resource: 'project:../p-2' }));
	invalid(() => input.nativeStart({ ...start, resource: 'project:' }));
	invalid(() => input.nativeStart({ ...start, resource: '*' }));
});

test('AuthRequestValidator normalizes a typed user code', () => {
	const approve = input.nativeApprove({ handoffId: opaque, userCode: ' abcd-efgh ' });
	expect(approve).toEqual({ handoffId: opaque, userCode: 'ABCDEFGH' });
	invalid(() => input.nativeApprove({ handoffId: opaque, userCode: 'ABC' }));
	invalid(() => input.nativeApprove({ handoffId: 'x', userCode: 'ABCDEFGH' }));
});

test('AuthRequestValidator requires every exchange binding', () => {
	const exchange = {
		handoffId: opaque,
		verifier: 'v'.repeat(43),
		nonce: 'n'.repeat(22),
		resource: 'projects'
	};
	expect(input.nativeExchange(exchange)).toEqual(exchange);
	expect(input.nativePoll({ handoffId: opaque })).toEqual({ handoffId: opaque });
	for (const key of Object.keys(exchange)) {
		invalid(() => input.nativeExchange({ ...exchange, [key]: undefined }));
	}
	invalid(() => input.nativeExchange({ ...exchange, verifier: 'v'.repeat(42) }));
});

test('AuthRequestValidator reads an OAuth callback only from code and state', () => {
	const url = (query: string) => new URL(`https://hub.test/api/github/callback?${query}`);
	expect(input.githubCallback(url(`code=abc123&state=${opaque}`))).toEqual({
		code: 'abc123',
		state: opaque
	});
	expect(input.githubCallback(url(`error=access_denied&state=${opaque}`))).toBeNull();
	expect(input.githubCallback(url('code=abc123'))).toBeNull();
	expect(input.githubCallback(url(`code=${'c'.repeat(300)}&state=${opaque}`))).toBeNull();
});

test('AuthRequestValidator accepts only a positive safe integer repository id', () => {
	expect(input.repositoryId(42)).toBe(42);
	for (const value of [0, -1, 1.5, '42', null, Number.MAX_SAFE_INTEGER + 1]) {
		invalid(() => input.repositoryId(value));
	}
});
