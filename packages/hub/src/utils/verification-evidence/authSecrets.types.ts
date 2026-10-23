export interface AuthSecrets {
	/** Keyed lookup hash, stored in place of an opaque secret. */
	hash(purpose: string, value: string): Promise<string>;
	seal(plain: string, context: string): Promise<string>;
	/** Null when the key, the context or the ciphertext does not match. */
	open(sealed: string, context: string): Promise<string | null>;
}
