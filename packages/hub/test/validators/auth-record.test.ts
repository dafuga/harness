import { expect, test } from 'vitest';
import { AuthRecordValidator } from '../../src/validators/AuthRecordValidator';

const records = new AuthRecordValidator();
const session = {
	id_hash: 'h',
	kind: 'native',
	parent_hash: 'p',
	actor_id: 'google-1',
	actor_email: 'ada@gmail.com',
	actor_name: 'Ada',
	resource: 'projects',
	created_at: 1,
	expires_at: 2,
	revoked_at: null
};
const exchange = {
	id: 'x',
	challenge: 'c',
	nonce_hash: 'n',
	code_hash: 'k',
	resource: 'projects',
	audience: 'harness-desktop',
	action: 'native-session',
	environment: 'production',
	origin: 'https://hub.test',
	status: 'pending',
	subject: null,
	parent_hash: null,
	expires_at: 9
};

test('AuthRecordValidator maps a stored session to a typed record', () => {
	expect(records.session(session)).toEqual({
		idHash: 'h',
		kind: 'native',
		parentHash: 'p',
		actor: { id: 'google-1', email: 'ada@gmail.com', name: 'Ada', emailVerified: true },
		resource: 'projects',
		createdAt: 1,
		expiresAt: 2,
		revokedAt: null
	});
});

test('AuthRecordValidator refuses rows with a wrong type, enum or missing column', () => {
	const corrupt = 'Hub auth record corrupt';
	expect(() => records.session({ ...session, kind: 'admin' })).toThrow(corrupt);
	expect(() => records.session({ ...session, expires_at: '2' })).toThrow(corrupt);
	expect(() => records.session({ ...session, actor_id: '' })).toThrow(corrupt);
	expect(() => records.session(null)).toThrow(corrupt);
	expect(() => records.exchange({ ...exchange, status: 'granted' })).toThrow(corrupt);
	expect(() => records.exchange({ ...exchange, environment: 'test' })).toThrow(corrupt);
	expect(() => records.challenge({ id_hash: 'h', nonce: 'n', expires_at: 1 })).toThrow(corrupt);
	expect(() => records.grant({ actor_id: 'a', github_user_id: 1.5 })).toThrow(corrupt);
});

test('AuthRecordValidator keeps nullable columns nullable and nothing else', () => {
	expect(records.exchange(exchange)).toMatchObject({ subject: null, parentHash: null });
	expect(records.exchange({ ...exchange, subject: 'google-1' }).subject).toBe('google-1');
	expect(() => records.exchange({ ...exchange, subject: 7 })).toThrow('Hub auth record corrupt');
});
