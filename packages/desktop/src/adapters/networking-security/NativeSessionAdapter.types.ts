/** Electron safeStorage is injected only by main; fixtures supply a deterministic encryption port. */
export interface NativeEncryption {
	isEncryptionAvailable(): boolean;
	getSelectedStorageBackend?(): string | undefined;
	encryptString(value: string): Buffer;
	decryptString(value: Buffer): string;
}
