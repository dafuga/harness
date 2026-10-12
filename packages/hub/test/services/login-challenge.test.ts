import { expect, test } from 'vitest';
import { CHALLENGE_TTL, LoginChallengeService } from '../../src/services/LoginChallengeService';
import { AuthFailure } from '../../src/utils/authFail';
import { authFixture } from '../support/authFixture';

function setup() {
	const fixture = authFixture();
	const { store, secrets, now } = fixture;
	return { fixture, service: new LoginChallengeService({ store: store.challenges, secrets, now }) };
}

test('a challenge returns its nonce once, to the browser that holds both halves', async () => {
	const { service, fixture } = setup();
	const { cookie, challenge } = await service.issue();
	expect(challenge.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(fixture.store.dump()).not.toContain(cookie);
	expect(fixture.store.dump()).not.toContain(challenge.csrf);
	expect(await service.consume(cookie, challenge.csrf)).toBe(challenge.nonce);
	await expect(service.consume(cookie, challenge.csrf)).rejects.toThrow(AuthFailure);
});

test('a wrong CSRF value fails and still consumes the challenge', async () => {
	const { service } = setup();
	const first = await service.issue();
	const second = await service.issue();
	await expect(service.consume(first.cookie, second.challenge.csrf)).rejects.toThrow(
		'Hub auth challenge-invalid'
	);
	await expect(service.consume(first.cookie, first.challenge.csrf)).rejects.toThrow(AuthFailure);
	expect(await service.consume(second.cookie, second.challenge.csrf)).toBe(second.challenge.nonce);
});

test('a missing cookie or an expired challenge is refused', async () => {
	const { service, fixture } = setup();
	const { cookie, challenge } = await service.issue();
	await expect(service.consume(null, challenge.csrf)).rejects.toThrow(AuthFailure);
	fixture.advance(CHALLENGE_TTL);
	await expect(service.consume(cookie, challenge.csrf)).rejects.toThrow(AuthFailure);
});

test('concurrent attempts consume a challenge exactly once', async () => {
	const { service } = setup();
	const { cookie, challenge } = await service.issue();
	const attempts = await Promise.allSettled(
		[1, 2, 3, 4].map(() => service.consume(cookie, challenge.csrf))
	);
	expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
});
