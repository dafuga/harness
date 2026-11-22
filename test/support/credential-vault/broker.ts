import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import type { VaultRunnerKey } from '../../../src/adapters/accounts-access/VaultSealAdapter.types';
import { VaultAuditRepository } from '../../../src/repositories/accounts-access/VaultAuditRepository';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { VaultBrokerService } from '../../../src/services/accounts-access/VaultBrokerService';
import type { VaultCreated } from '../../../src/services/accounts-access/VaultBrokerService.types';
import { VaultLeaseKeeperService } from '../../../src/services/accounts-access/VaultLeaseKeeperService';
import type {
	VaultApproval,
	VaultSessionRequest
} from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { createTempDirectory } from '../temporary';
import { FakePhone } from './phone';

const root = await createTempDirectory('vault-broker-');
let brokers = 0;

export const origin = 'https://vault.example.test';
export const sessionUid = 501;

/** A synthetic browser request for the fictional example-console site. */
export function sessionRequest(
	runner: VaultRunnerKey,
	overrides: Partial<VaultSessionRequest> = {}
): VaultSessionRequest {
	return {
		item: 'b9e3w0',
		session: 'claude-b9e3w0',
		project: 'harness',
		environment: 'synthetic',
		site: 'example-console',
		action: 'read-roster',
		account: 'synthetic-owner',
		mode: 'read',
		method: 'browser',
		recipe: { site: 'example-console', revision: 3, digest: 'e'.repeat(64) },
		host: 'mb2',
		runnerPublicKey: runner.publicKey,
		origins: ['https://console.example.test'],
		leaseMs: 900_000,
		reason: 'Read the synthetic roster.',
		...overrides
	};
}

/** A broker, lease keeper and enrolled fake phone on a controllable clock. */
export function vaultBroker() {
	const clock = { now: 1_800_000_000_000 };
	const now = () => clock.now;
	const phone = new FakePhone();
	const seal = new VaultSealAdapter();
	const state = join(root, String(++brokers));
	mkdirSync(state);
	const devices = new VaultDeviceRepository(
		[{ id: phone.deviceId, role: 'approver', signingKey: phone.signingKey }],
		origin,
		seal,
		now
	);
	const audit = new VaultAuditRepository(join(state, 'audit'));
	const broker = new VaultBrokerService(devices, audit, now);
	const keeper = new VaultLeaseKeeperService(broker, audit, join(state, 'run'), now);
	return { clock, phone, seal, state, devices, audit, broker, keeper };
}

/** The approval Harness iOS would sign for a queued request, with optional tampering. */
export function approval(
	input: VaultSessionRequest,
	created: VaultCreated,
	fixture: ReturnType<typeof vaultBroker>,
	overrides: Partial<VaultApproval> = {}
): VaultApproval {
	return {
		decision: 'approve',
		requestId: created.requestId,
		runnerFingerprint: created.runnerFingerprint,
		recipeDigest: input.recipe.digest,
		method: input.method,
		mode: input.mode,
		account: input.account,
		session: input.session,
		action: input.action,
		host: input.host,
		leaseMs: input.leaseMs,
		otpIncluded: true,
		expiresAt: fixture.clock.now + 30_000,
		sealed: fixture.phone.sealCanary(input.runnerPublicKey, created.requestId),
		...overrides
	};
}

/** Signs a decision over the binding the broker recorded, answering a fresh challenge. */
export function sign(
	fixture: ReturnType<typeof vaultBroker>,
	input: VaultSessionRequest,
	decision: VaultApproval | Record<string, unknown>
) {
	const { nonce } = fixture.devices.issue(fixture.phone.deviceId);
	const runnerFingerprint = fixture.seal.keyFingerprint(input.runnerPublicKey);
	const binding = { ...input, recipeDigest: input.recipe.digest, runnerFingerprint };
	return fixture.phone.decide(origin, nonce, decision as VaultApproval, binding);
}
