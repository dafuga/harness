// @harness-uid u_crruvpexlz
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import { vaultCdpEndpoint } from '../../utils/accounts-access/vaultCdpHandoff';
import type { VaultCdpDecision } from '../../utils/accounts-access/vaultCdpHandoff.types';
import { issueVaultLease, vaultLease } from '../../utils/accounts-access/vaultLease';
import { vaultTeardown } from '../../utils/accounts-access/vaultTeardown';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type { VaultTicket } from '../../validators/accounts-access/VaultWireValidator.types';
import { vaultAuditFields, type VaultBrokerService } from './VaultBrokerService';
import type {
	VaultAttachment,
	VaultHeldLease,
	VaultIssued,
	VaultLeaseEnded,
	VaultRelayEvent,
	VaultTeardownPaths
} from './VaultLeaseKeeperService.types';
import { admitVaultRelay, updateVaultRelay } from './vault-lease-keeper-service/relayLease';

function digest(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

/**
 * Leases after a verified login. The requesting session attaches once and receives the
 * one-time CDP token; the relay admits only that session's OS user with that token. Every
 * ending (finish, expiry, idle, unclaimed, revoke, shutdown) yields one teardown plan.
 */
export class VaultLeaseKeeperService {
	private readonly leases = new Map<string, VaultHeldLease>();

	constructor(
		private readonly broker: VaultBrokerService,
		private readonly audit: VaultAuditRepository,
		private readonly runDirectory: string,
		private readonly now: () => number = Date.now
	) {}

	/** Called by the ticket holder after the login script verified the account identity. */
	issue(ticket: VaultTicket, uid: number | null, teardown: VaultTeardownPaths): VaultIssued {
		const request = this.broker.delivered(ticket, uid);
		if ([...this.leases.values()].some((held) => held.request.id === request.id)) {
			throw new VaultBrokerError(409, 'This request already has a lease.');
		}
		if (request.uid === null) {
			throw new VaultBrokerError(403, 'A CDP lease needs the kernel-verified session user.');
		}
		const id = randomBytes(16).toString('hex');
		const state = issueVaultLease(id, request.input.session, this.now(), request.input.leaseMs);
		const socketPath = join(this.runDirectory, id, 'cdp.sock');
		const held = {
			state,
			request,
			sessionUid: request.uid,
			tokenDigest: null,
			socketPath,
			teardown,
			planned: false
		};
		this.leases.set(id, held);
		this.audit.append({ ...vaultAuditFields(request), lease: id }, 'lease');
		return { lease: id, claimBy: state.claimBy, expiresAt: state.expiresAt };
	}

	attach(lease: string, session: string, uid: number | null): VaultAttachment {
		const held = this.owned(lease, session, uid);
		if (held.tokenDigest !== null) {
			throw new VaultBrokerError(409, 'The lease is already attached; reconnect with its token.');
		}
		const checked = vaultLease(held.state, { type: 'claim', session, at: this.now() });
		if (!checked.accepted) {
			held.state = checked.state;
			this.refuse(checked.reason ?? 'The lease refused the call.');
		}
		const token = randomBytes(32).toString('base64url');
		held.tokenDigest = digest(token);
		this.audit.append({ ...vaultAuditFields(held.request), lease }, 'attach');
		const endpoint = vaultCdpEndpoint(held.socketPath);
		return {
			endpoint,
			headers: { Authorization: 'Bearer ' + token },
			expiresAt: held.state.expiresAt
		};
	}

	/** The relay's admission check for one connection on the lease's Unix socket. */
	admit(lease: string, peerUid: number | null, token: string): VaultCdpDecision {
		return admitVaultRelay(this.leases.get(lease), peerUid, token, this.now());
	}

	/** The executor gets the name of the allocated socket without issuing a session token. */
	relaySocketPath(lease: string): string {
		return this.leases.get(lease)?.socketPath ?? this.refuse('Lease not found.');
	}

	relayEvent(lease: string, type: VaultRelayEvent): boolean {
		return updateVaultRelay(this.leases.get(lease), type, this.now());
	}

	finish(lease: string, session: string, uid: number | null): VaultLeaseEnded {
		const held = this.owned(lease, session, uid);
		const result = vaultLease(held.state, { type: 'finish', at: this.now() });
		held.state = result.state;
		return this.plan(held) ?? this.refuse(result.reason ?? 'The lease already ended.');
	}

	/** Settles time limits on every lease and returns the teardown plans of those that ended. */
	sweep(): VaultLeaseEnded[] {
		const ended: VaultLeaseEnded[] = [];
		for (const held of this.leases.values()) {
			held.state = vaultLease(held.state, { type: 'tick', at: this.now() }).state;
			const plan = this.plan(held);
			if (plan) ended.push(plan);
		}
		return ended;
	}

	private plan(held: VaultHeldLease): VaultLeaseEnded | null {
		if (held.state.phase !== 'ended' || held.planned) return null;
		held.planned = true;
		const ended = held.state.ended ?? 'finished';
		this.audit.append(
			{ ...vaultAuditFields(held.request), lease: held.state.id, cause: ended },
			'lease-end'
		);
		const browser = held.request.input.method === 'browser';
		const input = {
			teardown: held.teardown,
			browser,
			leaseStartedAt: held.state.issuedAt,
			endedAt: this.now()
		};
		return { lease: held.state.id, ended, teardown: vaultTeardown(input) };
	}

	private owned(lease: string, session: string, uid: number | null): VaultHeldLease {
		const held = this.leases.get(lease);
		if (held?.state.session !== session || held.sessionUid !== uid) {
			throw new VaultBrokerError(404, 'Lease not found.');
		}
		return held;
	}

	private refuse(reason: string): never {
		throw new VaultBrokerError(409, reason);
	}
}

export type {
	VaultAttachment,
	VaultIssued,
	VaultLeaseEnded
} from './VaultLeaseKeeperService.types';
