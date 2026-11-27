// @harness-uid u_xwkimz47da
import type { VaultRunnerKey } from '../../adapters/accounts-access/VaultSealAdapter.types';
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { PrivateBrowserGateService } from './PrivateBrowserGateService';

export interface PrivateBrowserFieldScope {
	executor: string;
	origin: string;
	tabId: string;
	field: string;
	/** For a form with several fields, their fixed names in the expected fill order. */
	fields?: readonly string[];
	recipeDigest: string;
	action: string;
}

export interface PrivateBrowserPhoneOffer extends PrivateBrowserFieldScope {
	requestId: string;
	runnerPublicKey: string;
	runnerFingerprint: string;
	expiresAt: number;
}

export interface PrivateBrowserPhoneConfig {
	gate: PrivateBrowserGateService;
	devices: VaultDeviceRepository;
	now?: () => number;
	/**
	 * Recheck the reviewed tab, origin, fields and action before submitting.
	 * Plaintext is UTF-8 for one field, or a validated ordered JSON string array for several.
	 */
	submitField(
		scope: PrivateBrowserFieldScope,
		plaintext: Buffer,
		signal: AbortSignal
	): Promise<void>;
}

export interface PendingPhoneOffer {
	offer: PrivateBrowserPhoneOffer;
	scope: PrivateBrowserFieldScope;
	deviceId: string;
	key: VaultRunnerKey;
}
