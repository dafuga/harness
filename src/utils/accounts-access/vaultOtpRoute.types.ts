// @harness-uid u_fjkcftdpdm
import type { VaultOtpChannel } from './vaultRecipe.types';

export interface VaultOtpChallenge {
	kind: VaultOtpChannel;
	issuedAt: number;
}

export type VaultOtpPlan =
	| { route: 'phone-totp'; sealed: true; expiresAt: number }
	| {
			route: 'phone-entry';
			source: 'sms' | 'email';
			sealed: true;
			autofill: boolean;
			acceptsLink: boolean;
			attempts: number;
			expiresAt: number;
	  }
	| { route: 'device-confirm'; kind: 'push' | 'passkey'; sealed: false; expiresAt: number }
	| { route: 'stop'; reason: string };
