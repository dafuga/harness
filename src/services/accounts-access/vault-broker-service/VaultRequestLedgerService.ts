// @harness-uid u_hfim4j5obl
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { VaultSealAdapter } from '../../../adapters/accounts-access/VaultSealAdapter';
import type { VaultAuditRepository } from '../../../repositories/accounts-access/VaultAuditRepository';
import type { VaultAuditEventName } from '../../../repositories/accounts-access/VaultAuditRepository.types';
import { digestDisplay } from '../../../utils/accounts-access/vaultRecipe';
import { VaultBrokerError } from '../../../validators/accounts-access/VaultBrokerError';
import type {
	VaultSessionRequest,
	VaultTicket
} from '../../../validators/accounts-access/VaultWireValidator.types';
import type {
	VaultCreated,
	VaultQueueEntry,
	VaultRequestEntry,
	VaultRequestStatus
} from '../VaultBrokerService.types';

export const vaultRequestLimits = { offerMs: 120_000, deliveryMs: 60_000, queue: 16 } as const;
const seal = new VaultSealAdapter();

function digest(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

/** Owns the broker's request state, expiry and audited terminal transitions. */
export class VaultRequestLedgerService {
	private readonly requests = new Map<string, VaultRequestEntry>();

	constructor(
		private readonly audit: VaultAuditRepository,
		private readonly now: () => number
	) {}

	create(
		input: VaultSessionRequest,
		uid: number | null,
		preflightExpiresAt: number = Infinity
	): VaultCreated {
		const all = [...this.requests.values()];
		if (all.filter((entry) => this.live(entry)).length >= vaultRequestLimits.queue) {
			throw new VaultBrokerError(429, 'The broker queue is full.');
		}
		const runnerFingerprint = seal.keyFingerprint(input.runnerPublicKey);
		if (all.some((entry) => entry.runnerFingerprint === runnerFingerprint)) {
			throw new VaultBrokerError(409, 'Use a fresh runner key for each request.');
		}
		const now = this.now();
		const expiresAt = Math.min(now + vaultRequestLimits.offerMs, preflightExpiresAt);
		if (expiresAt <= now) throw new VaultBrokerError(403, 'Executor preflight has expired.');
		const { entry, receipt } = newEntry(input, uid, runnerFingerprint, expiresAt);
		this.audit.append(vaultAuditFields(entry), 'request');
		this.requests.set(entry.id, entry);
		return { requestId: entry.id, receipt, expiresAt: entry.expiresAt, runnerFingerprint };
	}

	phoneQueue(): VaultQueueEntry[] {
		return [...this.requests.values()]
			.filter((entry) => this.live(entry) && entry.status === 'pending')
			.map(queueEntry);
	}

	/** Recent synthetic requests, projected without tickets, request payloads or credentials. */
	operatorRequests() {
		return [...this.requests.values()]
			.reverse()
			.filter((entry) => entry.input.environment === 'synthetic')
			.slice(0, vaultRequestLimits.queue)
			.map((entry) => {
				this.live(entry);
				const {
					id: requestId,
					status,
					expiresAt,
					input: { site, action }
				} = entry;
				return { requestId, status, expiresAt, site, action };
			});
	}

	requirePending(id: string): VaultRequestEntry {
		const entry = this.requests.get(id);
		if (!entry || !this.live(entry) || entry.status !== 'pending') {
			throw new VaultBrokerError(409, 'Decision does not match a pending request.');
		}
		return entry;
	}

	find(ticket: VaultTicket, uid: number | null): VaultRequestEntry {
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

	end(entry: VaultRequestEntry, status: VaultRequestStatus, event: VaultAuditEventName) {
		this.audit.append(vaultAuditFields(entry), event);
		entry.status = status;
		entry.approval = undefined;
		return status;
	}
}

function newEntry(
	input: VaultSessionRequest,
	uid: number | null,
	fingerprint: string,
	expiresAt: number
) {
	const receipt = randomBytes(32).toString('base64url');
	const entry: VaultRequestEntry = {
		id: randomBytes(16).toString('hex'),
		input,
		uid,
		receiptDigest: digest(receipt),
		runnerFingerprint: fingerprint,
		status: 'pending',
		expiresAt
	};
	return { entry, receipt };
}

function receiptMatches(entry: VaultRequestEntry, receipt: string): boolean {
	const expected = Buffer.from(entry.receiptDigest, 'hex');
	return timingSafeEqual(expected, Buffer.from(digest(receipt), 'hex'));
}

export function vaultAuditFields(entry: VaultRequestEntry) {
	const { item, site, action, method, recipe, host } = entry.input;
	return { request: entry.id, item, site, action, method, recipeDigest: recipe.digest, host };
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
