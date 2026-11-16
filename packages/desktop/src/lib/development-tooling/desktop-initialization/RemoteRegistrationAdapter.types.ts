// @harness-uid u_l76zx7vxgv
import type { NativeHostedCredential } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';

export interface RemoteRegistrationAdapterConfig {
	/** The exact hub origin of this computer; without it there is no hosted identity. */
	origin?: string;
	/** The hosted session kept by the OS key store. It never leaves the main process. */
	credentials: () => Promise<NativeHostedCredential | null>;
	fetch?: typeof fetch;
}
/** The hub did not register this computer: it is signed out here, or its answer is invalid. */
export class HubRegistrationError extends Error {
	override name = 'HubRegistrationError';
}
