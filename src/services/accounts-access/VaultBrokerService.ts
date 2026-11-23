// @harness-uid u_hfim4j5obl
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { VaultSealAdapter } from '../../adapters/accounts-access/VaultSealAdapter';
import type { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import type { VaultAuditEventName } from '../../repositories/accounts-access/VaultAuditRepository.types';
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import { digestDisplay } from '../../utils/accounts-access/vaultRecipe';
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

export const vaultRequestLimits = { offerMs: 120_000, deliveryMs: 60_000, queue: 16 } as const;
const wire = new VaultWireValidator();
const seal = new VaultSealAdapter();
function digest(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

/**
 * The request queue. A request is bound at creation to its recipe digest, runner key, method
 * and scope; an approval must be signed over that binding (CB-DEVICE-V2) and restate the scope.
 * The approval is delivered once to the ticket holder and the request is then terminal.
 */
export class VaultBrokerService {
	private readonly requests = new Map<string, VaultRequestEntry>();

	constructor(
		private readonly devices: VaultDeviceRepository,
		private readonly audit: VaultAuditRepository,
		private readonly now: () => number = Date.now
	) {}

	create(input: VaultSessionRequest, uid: number | null): VaultCreated {
		const all = [...this.requests.values()];
		if (all.filter((entry) => this.live(entry)).length >= vaultRequestLimits.queue) {
			throw new VaultBrokerError(429, 'The broker queue is full.');
		}
		const runnerFingerprint = seal.keyFingerprint(input.runnerPublicKey);
		if (all.some((entry) => entry.runnerFingerprint === runnerFingerprint)) {
			throw new VaultBrokerError(409, 'Use a fresh runner key for each request.');
		}
		const { entry, receipt } = newEntry(input, uid, runnerFingerprint, this.now());
		this.record(entry, 'request');
		this.requests.set(entry.id, entry);
		return { requestId: entry.id, receipt, expiresAt: entry.expiresAt, runnerFingerprint };
	}

	/** The pending requests for an authenticated phone. */
	queue(proof: VaultProof): VaultQueueEntry[] {
		this.devices.authenticate('/v1/device/requests', proof);
		return [...this.requests.values()]
			.filter((entry) => this.live(entry) && entry.status === 'pending')
			.map(queueEntry);
	}

	decide(proof: VaultProof): VaultRequestStatus {
		const payload = Buffer.from(proof.payload, 'base64url');
		const decision = wire.json(vaultDecision, payload, 'decision');
		const entry = this.requests.get(decision.requestId);
		if (!entry || !this.live(entry) || entry.status !== 'pending') {
			throw new VaultBrokerError(409, 'Decision does not match a pending request.');
		}
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
		if (decision.decision === 'deny') return this.end(entry, 'denied', 'denial');
		checkApprovalScope(entry, decision, this.now());
		this.record(entry, 'approval');
		entry.status = 'approved';
		entry.approval = { proof, expiresAt: decision.expiresAt };
		return entry.status;
	}

	/** Hands the signed approval to the ticket holder once; the runner key opens its envelope. */
	claim(
		ticket: VaultTicket,
		uid: number | null
	): { approval: VaultProof; request: VaultSessionRequest } {
		const entry = this.find(ticket, uid);
		if (entry.status !== 'approved' || !entry.approval) {
			throw new VaultBrokerError(409, 'Approval is unavailable.');
		}
		const approval = entry.approval.proof;
		this.end(entry, 'delivered', 'delivery');
		return { approval, request: entry.input };
	}

	status(ticket: VaultTicket, uid: number | null): VaultRequestStatus {
		return this.find(ticket, uid).status;
	}

	cancel(ticket: VaultTicket, uid: number | null): VaultRequestStatus {
		const entry = this.find(ticket, uid);
		return ['pending', 'approved'].includes(entry.status)
			? this.end(entry, 'canceled', 'revoke')
			: entry.status;
	}

	/** The delivered request a ticket names, for issuing its lease. */
	delivered(ticket: VaultTicket, uid: number | null): VaultRequestEntry {
		const entry = this.find(ticket, uid);
		if (entry.status === 'delivered') return entry;
		throw new VaultBrokerError(409, 'The request was not delivered.');
	}

	private find(ticket: VaultTicket, uid: number | null): VaultRequestEntry {
		const entry = this.requests.get(ticket.requestId);
		if (entry?.uid !== uid || !receiptMatches(entry, ticket.receipt)) {
			throw new VaultBrokerError(404, 'Request not found.');
		}
		this.live(entry);
		return entry;
	}

	/** Expires a request whose offer or delivery window passed; true while it can still progress. */
	private live(entry: VaultRequestEntry): boolean {
		if (!['pending', 'approved'].includes(entry.status)) return false;
		const now = this.now();
		const lapsed = Math.min(entry.expiresAt, entry.approval?.expiresAt ?? Infinity) <= now;
		if (lapsed) this.end(entry, 'expired', 'expiry');
		return !lapsed;
	}

	private end(entry: VaultRequestEntry, status: VaultRequestStatus, event: VaultAuditEventName) {
		this.record(entry, event);
		entry.status = status;
		entry.approval = undefined;
		return status;
	}

	private record(entry: VaultRequestEntry, event: VaultAuditEventName): void {
		this.audit.append(vaultAuditFields(entry), event);
	}
}

function newEntry(
	input: VaultSessionRequest,
	uid: number | null,
	fingerprint: string,
	now: number
) {
	const receipt = randomBytes(32).toString('base64url');
	const entry: VaultRequestEntry = {
		id: randomBytes(16).toString('hex'),
		input,
		uid,
		receiptDigest: digest(receipt),
		runnerFingerprint: fingerprint,
		status: 'pending',
		expiresAt: now + vaultRequestLimits.offerMs
	};
	return { entry, receipt };
}

function receiptMatches(entry: VaultRequestEntry, receipt: string): boolean {
	const expected = Buffer.from(entry.receiptDigest, 'hex');
	return timingSafeEqual(expected, Buffer.from(digest(receipt), 'hex'));
}

/** The journal fields of a request: identifiers and digests only. */
export function vaultAuditFields(entry: VaultRequestEntry) {
	const { item, site, action, method, recipe, host } = entry.input;
	return { request: entry.id, item, site, action, method, recipeDigest: recipe.digest, host };
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

function queueEntry(entry: VaultRequestEntry): VaultQueueEntry {
	const { recipe, ...input } = entry.input;
	const shown = { ...recipe, display: digestDisplay(recipe.digest) };
	return {
		...input,
		requestId: entry.id,
		recipe: shown,
		runnerFingerprint: entry.runnerFingerprint,
		expiresAt: entry.expiresAt
	};
}

export type { VaultCreated, VaultQueueEntry, VaultRequestEntry } from './VaultBrokerService.types';
