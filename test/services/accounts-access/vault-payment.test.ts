import { expect, test } from 'vitest';
import { VaultPaymentService } from '../../../src/services/accounts-access/VaultPaymentService';
import { origin, vaultBroker } from '../../support/credential-vault/broker';
import { FakePhone } from '../../support/credential-vault/phone';

const scope = {
	item: '25e3ygwc13',
	session: 'test-session',
	description: 'One fixed-price reservation',
	card: { id: 'a'.repeat(32), lastFour: '4242' },
	checkout: {
		merchant: 'test-rental',
		origin: 'https://checkout.stripe.com',
		binding: 'b'.repeat(64),
		amountMinor: 5000,
		currency: 'CAD',
		mode: 'stripe-test'
	},
	recipeDigest: 'c'.repeat(64),
	runnerFingerprint: 'd'.repeat(64)
} as const;
const decisionPath = '/v1/device/purchase/decision';
const queuePath = '/v1/device/purchase/requests';

function payment() {
	const fixture = vaultBroker();
	const broker = new VaultPaymentService({
		devices: fixture.devices,
		audit: fixture.audit,
		host: 'mb2',
		now: () => fixture.clock.now
	});
	return { ...fixture, broker };
}

function pending() {
	const fixture = payment();
	fixture.broker.setEnabled(true);
	const offer = fixture.broker.request(scope);
	return { ...fixture, offer };
}

function signed(run: ReturnType<typeof pending>, change: Record<string, unknown> = {}) {
	const { nonce } = run.devices.issue(run.phone.deviceId);
	return run.phone.prove(origin, decisionPath, nonce, {
		requestId: run.offer.requestId,
		decision: 'approve',
		scope,
		expiresAt: run.clock.now + 60_000,
		...change
	});
}

test('a paid checkout requires an enrolled phone and consumes the exact approval once', () => {
	const run = pending();
	const { requestId } = run.offer;
	const { nonce } = run.devices.issue(run.phone.deviceId);
	const queue = run.broker.queue(run.phone.prove(origin, queuePath, nonce));
	expect(queue).toEqual([run.offer]);
	expect(queue[0]).not.toHaveProperty('host');
	queue[0].scope.checkout.amountMinor = 1;
	expect(() => run.broker.claim(requestId, scope.checkout, scope.runnerFingerprint)).toThrow(
		'Approval is unavailable.'
	);
	const proof = signed(run);
	expect(run.broker.decide(proof)).toBe('approved');
	expect(() => run.broker.decide(proof)).toThrow('invalid or expired');
	expect(run.broker.claim(requestId, scope.checkout, scope.runnerFingerprint)).toEqual({
		requestId,
		scope,
		expiresAt: run.clock.now + 60_000
	});
	expect(() => run.broker.claim(requestId, scope.checkout, scope.runnerFingerprint)).toThrow(
		'Approval is unavailable.'
	);
	const audit = run.audit.read();
	expect(audit.map(({ event }) => event)).toEqual(['request', 'approval', 'delivery']);
	expect(audit.every((entry) => entry.action === 'pay' && entry.item === scope.item)).toBe(true);
	expect(audit.every((entry) => !('card' in entry) && !('lastFour' in entry))).toBe(true);
	expect(JSON.stringify(audit)).not.toContain(scope.description);
});

test.each([
	['Tracker item', { ...scope, item: 'other25' }],
	['card', { ...scope, card: { ...scope.card, id: 'f'.repeat(32) } }],
	['description', { ...scope, description: 'Another reservation' }],
	['runner', { ...scope, runnerFingerprint: 'f'.repeat(64) }],
	['recipe', { ...scope, recipeDigest: 'f'.repeat(64) }]
])('a phone approval signed for a different %s is refused', (_field, changed) => {
	const run = pending();
	expect(() => run.broker.decide(signed(run, { scope: changed }))).toThrow('scope changed');
	expect(() =>
		run.broker.claim(run.offer.requestId, scope.checkout, scope.runnerFingerprint)
	).toThrow('Approval is unavailable.');
});

test.each([
	['merchant', { merchant: 'other-rental' }],
	['origin', { origin: 'https://other.example.test' }],
	['identity', { binding: 'e'.repeat(64) }],
	['amount', { amountMinor: 5001 }],
	['currency', { currency: 'USD' }]
])('a changed checkout %s revokes the signed attempt', (_field, change) => {
	const run = pending();
	run.broker.decide(signed(run));
	const claim = (checkout: unknown) =>
		run.broker.claim(run.offer.requestId, checkout, scope.runnerFingerprint);
	expect(() => claim({ ...scope.checkout, ...change })).toThrow('Checkout changed');
	expect(() => claim(scope.checkout)).toThrow('Approval is unavailable.');
	expect(run.audit.read().at(-1)).toMatchObject({ event: 'revoke', cause: 'checkout-changed' });
});

test('decisions are bound to an enrolled signing key and the purchase route', () => {
	const run = pending();
	const body = { requestId: run.offer.requestId, decision: 'deny' };
	const { nonce } = run.devices.issue(run.phone.deviceId);
	const impostor = new FakePhone(run.phone.deviceId);
	expect(() => run.broker.decide(impostor.prove(origin, decisionPath, nonce, body))).toThrow(
		'invalid or expired'
	);
	const second = run.devices.issue(run.phone.deviceId);
	expect(() => run.broker.decide(run.phone.prove(origin, queuePath, second.nonce, body))).toThrow(
		'invalid or expired'
	);
	const denied = signed(run, { decision: 'deny', scope: undefined, expiresAt: undefined });
	expect(run.broker.decide(denied)).toBe('denied');
	expect(() =>
		run.broker.claim(run.offer.requestId, scope.checkout, scope.runnerFingerprint)
	).toThrow('Approval is unavailable.');
});

test('the kill switch starts closed and reopening it cannot restore an earlier approval', () => {
	const run = payment();
	expect(() => run.broker.request(scope)).toThrow('Vault purchases are disabled.');
	const armed = pending();
	armed.broker.decide(signed(armed));
	armed.broker.setEnabled(false);
	armed.broker.setEnabled(true);
	expect(() =>
		armed.broker.claim(armed.offer.requestId, scope.checkout, scope.runnerFingerprint)
	).toThrow('Approval is unavailable.');
	expect(armed.audit.read().at(-1)).toMatchObject({ event: 'revoke', cause: 'disabled' });
});

test('offer and approval expire at their own deadlines', () => {
	const approved = pending();
	expect(() =>
		approved.broker.decide(signed(approved, { expiresAt: approved.clock.now + 60_001 }))
	).toThrow('approval window');
	approved.broker.decide(signed(approved));
	approved.clock.now += 60_000;
	expect(() =>
		approved.broker.claim(approved.offer.requestId, scope.checkout, scope.runnerFingerprint)
	).toThrow('Approval is unavailable.');
	const offered = pending();
	offered.clock.now += 120_000;
	expect(() => offered.broker.decide(signed(offered))).toThrow('Approval is unavailable.');
});

test('purchase input accepts metadata for a fixed test-mode total only', () => {
	const run = payment();
	run.broker.setEnabled(true);
	for (const checkout of [
		{ ...scope.checkout, amountMinor: 0.01 },
		{ ...scope.checkout, mode: 'live' },
		{ ...scope.checkout, origin: 'https://checkout.stripe.com/unreviewed' },
		{ ...scope.checkout, origin: 'https://name:pass@checkout.stripe.com' }
	]) {
		expect(() => run.broker.request({ ...scope, checkout })).toThrow('Invalid purchase scope');
	}
	expect(() => run.broker.request({ ...scope, card: { ...scope.card, number: 'canary' } })).toThrow(
		'Invalid purchase scope'
	);
	expect(run.audit.read()).toEqual([]);
});
