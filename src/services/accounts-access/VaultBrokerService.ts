// @harness-uid u_hfim4j5obl
import type { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import {
	VaultWireValidator,
	vaultDecision
} from '../../validators/accounts-access/VaultWireValidator';
import type {
	VaultApproval,
	VaultProof,
	VaultSessionRequest,
	VaultTicket
} from '../../validators/accounts-access/VaultWireValidator.types';
import type {
	VaultCreated,
	VaultQueueEntry,
	VaultRequestEntry,
	VaultRequestStatus
} from './VaultBrokerService.types';

import {
	vaultAuditFields,
	vaultRequestLimits,
	VaultRequestLedgerService
} from './vault-broker-service/VaultRequestLedgerService';

const wire = new VaultWireValidator();

export {
	vaultAuditFields,
	vaultRequestLimits
} from './vault-broker-service/VaultRequestLedgerService';

/**
 * The request queue. A request is bound at creation to its recipe digest, runner key, method
 * and scope; an approval must be signed over that binding (CB-DEVICE-V2) and restate the scope.
 * The approval is delivered once to the ticket holder and the request is then terminal.
 */
export class VaultBrokerService {
	private readonly ledger: VaultRequestLedgerService;

	constructor(
		private readonly devices: VaultDeviceRepository,
		private readonly audit: VaultAuditRepository,
		private readonly now: () => number = Date.now
	) {
		this.ledger = new VaultRequestLedgerService(audit, now);
	}

	create(
		input: VaultSessionRequest,
		uid: number | null,
		preflightExpiresAt = Infinity
	): VaultCreated {
		return this.ledger.create(input, uid, preflightExpiresAt);
	}

	queue(proof: VaultProof): VaultQueueEntry[] {
		this.devices.authenticate('/v1/device/requests', proof);
		return this.ledger.phoneQueue();
	}

	/** Recent synthetic requests without tickets, request payloads or credentials. */
	operatorRequests() {
		return this.ledger.operatorRequests();
	}

	decide(proof: VaultProof): VaultRequestStatus {
		const payload = Buffer.from(proof.payload, 'base64url');
		const decision = wire.json(vaultDecision, payload, 'decision');
		const entry = this.ledger.requirePending(decision.requestId);
		const binding = {
			...entry.input,
			recipeDigest: entry.input.recipe.digest,
			runnerFingerprint: entry.runnerFingerprint
		};
		this.devices.authenticateDecision(proof, binding);
		if (
			decision.runnerFingerprint !== binding.runnerFingerprint ||
			decision.recipeDigest !== binding.recipeDigest
		) {
			throw new VaultBrokerError(409, 'The decision is for another runner or recipe.');
		}
		if (decision.decision === 'deny') return this.ledger.end(entry, 'denied', 'denial');
		checkApprovalScope(entry, decision, this.now());
		this.audit.append(vaultAuditFields(entry), 'approval');
		entry.status = 'approved';
		entry.approval = { proof, expiresAt: decision.expiresAt };
		return entry.status;
	}

	claim(
		ticket: VaultTicket,
		uid: number | null
	): { approval: VaultProof; request: VaultSessionRequest } {
		const entry = this.ledger.find(ticket, uid);
		if (entry.status !== 'approved' || !entry.approval) {
			throw new VaultBrokerError(409, 'Approval is unavailable.');
		}
		const approval = entry.approval.proof;
		this.ledger.end(entry, 'delivered', 'delivery');
		return { approval, request: entry.input };
	}

	status(ticket: VaultTicket, uid: number | null): VaultRequestStatus {
		return this.ledger.find(ticket, uid).status;
	}

	cancel(ticket: VaultTicket, uid: number | null): VaultRequestStatus {
		const entry = this.ledger.find(ticket, uid);
		return ['pending', 'approved'].includes(entry.status)
			? this.ledger.end(entry, 'canceled', 'revoke')
			: entry.status;
	}

	delivered(ticket: VaultTicket, uid: number | null): VaultRequestEntry {
		const entry = this.ledger.find(ticket, uid);
		if (entry.status === 'delivered') return entry;
		throw new VaultBrokerError(409, 'The request was not delivered.');
	}
}

function checkApprovalScope(entry: VaultRequestEntry, decision: VaultApproval, now: number): void {
	const { input } = entry;
	const keys = ['method', 'mode', 'account', 'session', 'action', 'host', 'leaseMs'] as const;
	if (keys.some((key) => decision[key] !== input[key])) {
		throw new VaultBrokerError(409, 'The approval scope differs from the request; approve again.');
	}
	if ((decision.sealed === null) !== (input.method === 'oauth-device')) {
		throw new VaultBrokerError(409, 'Only a device grant approval carries no sealed credential.');
	}
	const latest = Math.min(now + vaultRequestLimits.deliveryMs, entry.expiresAt);
	if (decision.expiresAt <= now || decision.expiresAt > latest) {
		throw new VaultBrokerError(409, 'Approval expiry is outside the delivery window.');
	}
}

export type { VaultCreated, VaultQueueEntry, VaultRequestEntry } from './VaultBrokerService.types';
