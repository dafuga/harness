import type { SecureFailureReason } from './RemoteSecure.types';
/** A violation of the secure channel. The connection is closed; nothing is answered. */
export class SecureFailure extends Error {
	constructor(readonly reason: SecureFailureReason) {
		super(`Secure channel ${reason}`);
		this.name = 'SecureFailure';
	}
}
