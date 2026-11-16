// @harness-uid u_ytwarm6wyy
export class InvalidStoredHostedSessionError extends Error {
	override name = 'InvalidStoredHostedSessionError';
}

export class StoredHostedSessionUnavailableError extends Error {
	override name = 'StoredHostedSessionUnavailableError';
}

export class HostedSessionEncryptionRequiredError extends Error {
	override name = 'HostedSessionEncryptionRequiredError';
}

/** Electron safeStorage is injected only by main; fixtures supply a deterministic encryption port. */
export interface NativeEncryption {
	isEncryptionAvailable(): boolean;
	getSelectedStorageBackend?(): string | undefined;
	encryptString(value: string): Buffer;
	decryptString(value: Buffer): string;
}
