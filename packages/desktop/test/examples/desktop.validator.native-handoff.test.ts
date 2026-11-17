import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeHandoffValidator } from '../../src/validators/development-tooling/NativeHandoffValidator';

const validator = new NativeHandoffValidator();
const now = 1794657600000;
const origin = 'https://harness.example.com';
const handoffId = 'k3VyQ8wLx0Tn5pZbH2mJ7sEaRd9gYcKfU4oN1iXqW6A';
const handoff = {
	handoffId,
	userCode: 'KQ7M-3TWD',
	verificationUrl: `${origin}/native/${handoffId}`,
	expiresAt: '2026-11-14T12:05:00.000Z',
	interval: 2,
	ignored: 'extra response metadata'
};

test('accepts a valid native handoff start response', () => {
	const output = validator.start(handoff, origin, now);
	expect(output).toEqual({
		handoffId,
		userCode: 'KQ7M-3TWD',
		verificationUrl: `${origin}/native/${handoffId}`,
		expiresAt: '2026-11-14T12:05:00.000Z',
		interval: 2
	});
	recordExampleCases(
		{
			unitId: 'desktop.validator.native-handoff',
			symbol: 'NativeHandoffValidator.start',
			state: 'accepts-a-valid-native-handoff-start-response',
			evidence: 'examples-cases',
			file: 'accepts-a-valid-native-handoff-start-response.json'
		},
		[{ name: 'valid hosted start response', input: { value: handoff, origin, now }, output }]
	);
});

test('exchanges a correctly bound native handoff response', () => {
	const expected = {
		origin,
		nonce: 'Qz8rT1mVb4xNs0KwLh7YcEaPdU2gJfRo',
		resource: 'projects'
	};
	const value = {
		authorization: 'Tq4VbN8sLk2XzR7wYc0HdJ3mPa9EgUfK1oiWx5nBrZ6',
		actor: {
			id: 'google-104827365192837461029',
			email: 'ada.sample@example.com',
			name: 'Ada Sample',
			emailVerified: true
		},
		audience: 'harness-desktop',
		resource: 'projects',
		nonce: expected.nonce,
		expiresAt: '2026-12-14T12:01:00.000Z',
		ignored: 'extra response metadata'
	};
	const output = validator.exchange(value, expected, now);
	expect(output).toEqual({
		credential: {
			origin,
			principalId: 'google-104827365192837461029',
			token: value.authorization
		},
		status: {
			configured: true,
			state: 'signed-in',
			actor: {
				id: 'google-104827365192837461029',
				email: 'ada.sample@example.com',
				name: 'Ada Sample'
			}
		}
	});
	recordExampleCases(
		{
			unitId: 'desktop.validator.native-handoff',
			symbol: 'NativeHandoffValidator.exchange',
			state: 'exchanges-a-correctly-bound-native-handoff-response',
			evidence: 'examples-cases',
			file: 'exchanges-a-correctly-bound-native-handoff-response.json'
		},
		[{ name: 'valid exchange response', input: { value, expected, now }, output }]
	);
});
