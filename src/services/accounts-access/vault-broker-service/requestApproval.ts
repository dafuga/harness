// @harness-uid u_hfim4j5obl
import { VaultBrokerError } from '../../../validators/accounts-access/VaultBrokerError';
import { vaultPasswordAction } from '../../../validators/accounts-access/VaultWireValidator';
import type { VaultApproval } from '../../../validators/accounts-access/VaultWireValidator.types';
import type { VaultRequestEntry } from '../VaultBrokerService.types';

export const vaultRequestLimits = { offerMs: 120_000, deliveryMs: 60_000, queue: 16 } as const;

export function checkApprovalScope(
	entry: VaultRequestEntry,
	decision: VaultApproval,
	now: number
): void {
	const { input } = entry;
	const keys = ['method', 'mode', 'account', 'session', 'action', 'host', 'leaseMs'] as const;
	if (keys.some((key) => decision[key] !== input[key])) {
		throw new VaultBrokerError(409, 'The approval scope differs from the request; approve again.');
	}
	const generation = input.action === vaultPasswordAction;
	if (
		generation &&
		(decision.project !== input.project ||
			decision.environment !== input.environment ||
			decision.otpIncluded)
	) {
		throw new VaultBrokerError(409, 'The password approval scope differs from the request.');
	}
	if ((decision.sealed === null) !== (input.method === 'oauth-device' || generation)) {
		throw new VaultBrokerError(
			409,
			'Only a device grant or password generation approval carries no sealed credential.'
		);
	}
	const latest = Math.min(now + vaultRequestLimits.deliveryMs, entry.expiresAt);
	if (decision.expiresAt <= now || decision.expiresAt > latest) {
		throw new VaultBrokerError(409, 'Approval expiry is outside the delivery window.');
	}
}
