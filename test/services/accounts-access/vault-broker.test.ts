import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { VaultBrokerService } from '../../../src/services/accounts-access/VaultBrokerService';
import {
	approval,
	origin,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';
import { canary } from '../../support/credential-vault/phone';

function pending() {
	const fixture = vaultBroker();
	const runner = fixture.seal.runnerKey();
	const input = sessionRequest(runner);
	const created = fixture.broker.create(input, sessionUid);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	return { ...fixture, runner, input, created, ticket };
}

test('an approval signed over the binding is delivered once and opens only in the runner', () => {
	const run = pending();
	const { nonce } = run.devices.issue(run.phone.deviceId);
	const queue = run.broker.queue(run.phone.prove(origin, '/v1/device/requests', nonce));
	expect(queue).toHaveLength(1);
	expect(queue[0]).toMatchObject({ site: 'example-console', mode: 'read', method: 'browser' });
	expect(queue[0]?.recipe.display).toBe('eeee eeee eeee eeee');
	expect(queue[0]?.runnerPublicKey).toBe(run.runner.publicKey);
	expect(queue[0]?.runnerFingerprint).toBe(run.seal.keyFingerprint(run.runner.publicKey));
	expect(queue[0]).not.toHaveProperty('receipt');
	const proof = sign(run, run.input, approval(run.input, run.created, run));
	expect(run.broker.decide(proof)).toBe('approved');
	const { approval: delivered } = run.broker.claim(run.ticket, sessionUid);
	const payload = JSON.parse(Buffer.from(delivered.payload, 'base64url').toString('utf8'));
	expect(
		JSON.parse(run.runner.open(run.created.requestId, payload.sealed).toString())
	).toMatchObject(canary);
	expect(() => run.broker.claim(run.ticket, sessionUid)).toThrow('Approval is unavailable.');
	expect(run.broker.status(run.ticket, sessionUid)).toBe('delivered');
	const journal = readFileSync(join(run.state, 'audit', 'audit.jsonl'), 'utf8');
	expect(journal).not.toContain(canary.password);
	expect(journal).not.toContain(canary.otp);
});

test.each<[string, Record<string, unknown>]>([
	['mode', { mode: 'write' }],
	['session', { session: 'another-session' }],
	['lease length', { leaseMs: 3_600_000 }],
	['account', { account: 'other-owner' }],
	['host', { host: 'grok-box' }]
])('an approval with a changed %s is refused', (_name, change) => {
	const run = pending();
	const proof = sign(run, run.input, approval(run.input, run.created, run, change));
	expect(() => run.broker.decide(proof)).toThrow('approve again');
	expect(run.broker.status(run.ticket, sessionUid)).toBe('pending');
});

test('a signature over another recipe digest or runner is refused', () => {
	const run = pending();
	const other = { ...run.input, recipe: { ...run.input.recipe, digest: 'f'.repeat(64) } };
	const proof = sign(run, other, approval(run.input, run.created, run));
	expect(() => run.broker.decide(proof)).toThrow('invalid or expired');
	const replay = sign(run, run.input, approval(run.input, run.created, run));
	expect(run.broker.decide(replay)).toBe('approved');
	expect(() => run.broker.decide(replay)).toThrow('pending request');
});

test('approval windows, denial, cancellation and the wrong caller', () => {
	const run = pending();
	const late = approval(run.input, run.created, run, { expiresAt: run.clock.now + 61_000 });
	expect(() => run.broker.decide(sign(run, run.input, late))).toThrow('delivery window');
	expect(() => run.broker.status(run.ticket, 777)).toThrow('Request not found.');
	expect(() =>
		run.broker.status(
			{ ...run.ticket, receipt: run.ticket.receipt.replace(/^./u, 'A') },
			sessionUid
		)
	).toThrow('Request not found.');
	const deny = {
		decision: 'deny',
		requestId: run.created.requestId,
		runnerFingerprint: run.created.runnerFingerprint,
		recipeDigest: run.input.recipe.digest
	};
	expect(run.broker.decide(sign(run, run.input, deny))).toBe('denied');
	const second = pending();
	expect(second.broker.cancel(second.ticket, sessionUid)).toBe('canceled');
	const third = pending();
	third.clock.now += 120_000;
	expect(third.broker.status(third.ticket, sessionUid)).toBe('expired');
	expect(third.audit.read().map(({ event }) => event)).toEqual(['request', 'expiry']);
});

test('only a device grant approval may omit the sealed credential, and keys are single use', () => {
	const run = pending();
	const empty = approval(run.input, run.created, run, { sealed: null });
	expect(() => run.broker.decide(sign(run, run.input, empty))).toThrow('device grant');
	expect(() => run.broker.create(run.input, sessionUid)).toThrow('fresh runner key');
});

test('password generation requires one approved scope and executes once with a status-only result', async () => {
	const run = vaultBroker();
	const input = sessionRequest(run.seal.runnerKey(), {
		action: 'generate-password',
		mode: 'write'
	});
	const execute = vi.fn(async () => undefined);
	const broker = new VaultBrokerService(
		run.devices,
		run.audit,
		() => run.clock.now,
		(request) => (request === input ? execute : undefined)
	);
	expect(() => broker.create({ ...input, environment: 'production' }, sessionUid)).toThrow(
		'unavailable'
	);
	const ticket = broker.create(input, sessionUid);
	await expect(broker.generatePassword(ticket, sessionUid)).rejects.toThrow(
		'Approval is unavailable'
	);
	const decision = approval(input, ticket, run, {
		sealed: null,
		otpIncluded: false,
		project: input.project,
		environment: input.environment
	});
	const wrongScope = { ...decision, environment: 'production' };
	expect(() => broker.decide(sign(run, input, wrongScope))).toThrow('approval scope');
	expect(broker.decide(sign(run, input, decision))).toBe('approved');
	expect(() => broker.claim(ticket, sessionUid)).toThrow('password generation');
	await expect(broker.generatePassword(ticket, 777)).rejects.toThrow('Request not found');
	const operation = broker.generatePassword(ticket, sessionUid);
	await expect(broker.generatePassword(ticket, sessionUid)).resolves.toBe('executing');
	await expect(operation).resolves.toBe('completed');
	await expect(broker.generatePassword(ticket, sessionUid)).resolves.toBe('completed');
	expect(execute).toHaveBeenCalledTimes(1);
});
