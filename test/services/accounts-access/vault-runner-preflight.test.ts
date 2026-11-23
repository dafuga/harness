import { expect, test } from 'vitest';
import { VaultRunnerPreflightService } from '../../../src/services/accounts-access/VaultRunnerPreflightService';
import { sessionRequest, sessionUid, vaultBroker } from '../../support/credential-vault/broker';
import { syntheticExecutor } from '../../support/credential-vault/executor';

test('requires the pinned executor, kernel UID, unchanged scope, and live broker instance', () => {
	const { clock, seal } = vaultBroker();
	const executor = syntheticExecutor();
	const other = syntheticExecutor();
	const now = () => clock.now;
	const service = new VaultRunnerPreflightService([executor.pin], now);
	const request = sessionRequest(seal.runnerKey());
	const scope = {
		brokerId: service.brokerId,
		uid: sessionUid,
		issuedAt: now(),
		expiresAt: now() + 60_000
	};
	const proof = executor.attest(request, scope);
	expect(service.verify(request, sessionUid, proof)).toBe(scope.expiresAt);
	const changed = [
		{ ...request, runnerPublicKey: seal.runnerKey().publicKey },
		{ ...request, host: 'unregistered' },
		{ ...request, recipe: { ...request.recipe, digest: 'a'.repeat(64) } },
		{ ...request, item: 'another1' },
		{ ...request, project: 'other' },
		{ ...request, environment: 'other' },
		{ ...request, reason: 'Changed purpose.' },
		{ ...request, origins: ['https://another.example.test'] }
	];
	for (const input of changed) {
		expect(() => service.verify(input, sessionUid, proof)).toThrow('valid executor preflight');
	}
	for (const uid of [null, 0, sessionUid + 1]) {
		expect(() => service.verify(request, uid, proof)).toThrow('valid executor preflight');
	}
	expect(() => service.verify(request, sessionUid)).toThrow('valid executor preflight');
	expect(() => service.verify(request, sessionUid, other.attest(request, scope))).toThrow();
	const live = { ...request, origins: ['https://console.example.com'] };
	expect(() => service.verify(live, sessionUid, executor.attest(live, scope))).toThrow(
		'valid executor preflight'
	);
	const restarted = new VaultRunnerPreflightService([executor.pin], now);
	expect(() => restarted.verify(request, sessionUid, proof)).toThrow('valid executor preflight');
	clock.now = scope.expiresAt;
	expect(() => service.verify(request, sessionUid, proof)).toThrow('valid executor preflight');
});

test('refuses ambiguous executor pins and authorization windows longer than two minutes', () => {
	const { clock, seal } = vaultBroker();
	const executor = syntheticExecutor();
	expect(() => new VaultRunnerPreflightService([executor.pin, executor.pin])).toThrow(
		'trust configuration'
	);
	const service = new VaultRunnerPreflightService([executor.pin], () => clock.now);
	const request = sessionRequest(seal.runnerKey());
	const proof = executor.attest(request, {
		brokerId: service.brokerId,
		uid: sessionUid,
		issuedAt: clock.now,
		expiresAt: clock.now + 120_001
	});
	expect(() => service.verify(request, sessionUid, proof)).toThrow('valid executor preflight');
});
