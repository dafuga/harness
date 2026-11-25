// @harness-uid u_hfim4j5obl
import type { VaultAuditRepository } from '../../../repositories/accounts-access/VaultAuditRepository';
import type { VaultAuditEventName } from '../../../repositories/accounts-access/VaultAuditRepository.types';
import { VaultBrokerError } from '../../../validators/accounts-access/VaultBrokerError';
import { vaultPasswordAction } from '../../../validators/accounts-access/VaultWireValidator';
import type { VaultSessionRequest } from '../../../validators/accounts-access/VaultWireValidator.types';
import type {
	VaultPasswordPreparation,
	VaultRequestEntry,
	VaultRequestStatus
} from '../VaultBrokerService.types';

export function preparePasswordOperation(
	input: VaultSessionRequest,
	prepare?: VaultPasswordPreparation
) {
	if (input.action !== vaultPasswordAction) return undefined;
	const execute = input.method === 'browser' && input.mode === 'write' && prepare?.(input);
	if (!execute)
		throw new VaultBrokerError(403, 'The reviewed password generation executor is unavailable.');
	return execute;
}

export async function runApprovedPassword(entry: VaultRequestEntry, audit: VaultAuditRepository) {
	if (!entry.generatePassword) throw new VaultBrokerError(409, 'This is not a password request.');
	if (['executing', 'completed', 'failed'].includes(entry.status)) return entry.status;
	if (entry.status !== 'approved') throw new VaultBrokerError(409, 'Approval is unavailable.');
	endVaultRequest(entry, audit, 'executing', 'password-start');
	try {
		await entry.generatePassword();
	} catch {
		return endVaultRequest(entry, audit, 'failed', 'password-failed');
	}
	return endVaultRequest(entry, audit, 'completed', 'password-complete');
}

export function endVaultRequest(
	entry: VaultRequestEntry,
	audit: VaultAuditRepository,
	status: VaultRequestStatus,
	event: VaultAuditEventName
) {
	audit.append(vaultAuditFields(entry), event);
	entry.status = status;
	entry.approval = undefined;
	return status;
}

/** The journal fields of a request: identifiers and digests only. */
export function vaultAuditFields(entry: VaultRequestEntry) {
	const { item, site, action, method, recipe, host } = entry.input;
	return { request: entry.id, item, site, action, method, recipeDigest: recipe.digest, host };
}
