// @harness-uid u_5uyy7czfil
import type { vaultMethods } from '../../../../../remote/src/index';

export type VaultPhoneMethod = (typeof vaultMethods)[number];

export type VaultPhoneCall = (
	method: VaultPhoneMethod,
	input: Record<string, unknown>
) => Promise<unknown>;

export interface VaultPhoneConfig {
	phone: string;
	generation: number;
	origin: string;
	deviceId: string;
	socketPath: string;
}
