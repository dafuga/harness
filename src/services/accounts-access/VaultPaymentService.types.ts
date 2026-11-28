// @harness-uid u_4hbuoweikr
import type { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { VaultPaymentScope } from '../../validators/accounts-access/VaultPaymentValidator.types';

export interface VaultPaymentOffer {
	requestId: string;
	scope: VaultPaymentScope;
	expiresAt: number;
}

export interface VaultPaymentEntry {
	offer: VaultPaymentOffer;
	approvalExpiresAt?: number;
}

export interface VaultPaymentDependencies {
	devices: VaultDeviceRepository;
	audit: VaultAuditRepository;
	host: string;
	now: () => number;
}
