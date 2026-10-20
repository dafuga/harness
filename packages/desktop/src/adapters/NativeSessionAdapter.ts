import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NativeHostedCredential } from '../lib/desktop-initialization/remote-http-project-adapter/RemoteHttpProjectAdapter';
/** Electron safeStorage is injected only by main; fixtures supply a deterministic encryption port. */
export interface NativeEncryption {
	isEncryptionAvailable(): boolean;
	getSelectedStorageBackend?(): string | undefined;
	encryptString(value: string): Buffer;
	decryptString(value: Buffer): string;
}
export class NativeSessionAdapter {
	generation = 0;
	constructor(
		private file: string,
		private encryption: NativeEncryption,
		private platform: NodeJS.Platform = process.platform
	) {}
	invalidate(): void {
		this.generation++;
	}
	available(): boolean {
		if (!this.encryption.isEncryptionAvailable()) return false;
		if (this.platform !== 'linux') return true;
		try {
			return ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(
				this.encryption.getSelectedStorageBackend?.() ?? 'unknown'
			);
		} catch {
			return false;
		}
	}
	async read(): Promise<NativeHostedCredential | null> {
		if (!this.available()) return null;
		try {
			const stored = JSON.parse(this.encryption.decryptString(await readFile(this.file)));
			if (
				typeof stored.origin !== 'string' ||
				typeof stored.principalId !== 'string' ||
				typeof stored.token !== 'string'
			)
				throw new Error('Invalid session');
			return stored as NativeHostedCredential;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
			throw new Error('Stored hosted session is unavailable. Sign in again.');
		}
	}
	async save(credential: NativeHostedCredential): Promise<void> {
		this.generation++;
		if (!this.available()) throw new Error('OS encryption is required for hosted sessions.');
		const bytes = this.encryption.encryptString(JSON.stringify(credential));
		await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
		const temporary = `${this.file}.${randomUUID()}.tmp`;
		await writeFile(temporary, bytes, { mode: 0o600 });
		await rename(temporary, this.file);
	}
	async clear(): Promise<void> {
		this.generation++;
		await unlink(this.file).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
		});
	}
}
