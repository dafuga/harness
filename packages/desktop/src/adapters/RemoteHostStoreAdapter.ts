import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StoredRemoteKeys } from '../../../remote/src/index';
import { NativeSessionAdapter } from './NativeSessionAdapter';
import type { NativeEncryption } from './NativeSessionAdapter';

/** A phone the person approved, with the exact key and grant of that approval. */
export interface RemoteHostDevice {
	deviceId: string;
	deviceKey: string;
	name: string;
	platform: string;
	projects: { id: string; name: string }[];
	/** False grants read-only access; omitted preserves older read-and-comment grants. */
	comments?: boolean;
	agents: boolean;
	approvedAt: string;
	generation: number;
	lastSeenAt: string | null;
}
/** Everything this computer keeps for remote access. It exists on disk only encrypted. */
export interface RemoteHostState {
	enabled: boolean;
	origin: string | null;
	hostId: string;
	keys: StoredRemoteKeys;
	credential: string;
	generation: number;
	devices: RemoteHostDevice[];
	/** Devices revoked while the relay was unreachable; it is told when it is back. */
	revoked: string[];
}
export interface RemoteHostStoreAdapterConfig {
	file: string;
	/** Electron safeStorage in the app; a deterministic port in tests. */
	encryption: NativeEncryption;
	platform?: NodeJS.Platform;
}
const required = 'OS encryption is required for remote access.';
const unreadable = 'Stored remote access state is unreadable. Turn remote access on again.';

function identified(item: Partial<RemoteHostState>): boolean {
	const keys = item.keys ?? ({} as Partial<StoredRemoteKeys>);
	return [item.hostId, item.credential, keys.d, keys.publicKey].every(
		(value) => typeof value === 'string' && value.length > 0
	);
}
function valid(value: unknown): value is RemoteHostState {
	const item = (value ?? {}) as Partial<RemoteHostState>;
	const lists = Array.isArray(item.devices) && Array.isArray(item.revoked);
	return typeof item.enabled === 'boolean' && lists && identified(item);
}

/** Host keys, host credential and approved devices, sealed by the OS key store. Fails closed. */
export class RemoteHostStoreAdapter {
	private readonly gate: NativeSessionAdapter;
	constructor(private readonly config: RemoteHostStoreAdapterConfig) {
		this.gate = new NativeSessionAdapter(config.file, config.encryption, config.platform);
	}
	available(): boolean {
		return this.gate.available();
	}
	/** Null when nothing was stored. A file that cannot be opened is an error, not a fresh start. */
	async read(): Promise<RemoteHostState | null> {
		if (!this.available()) throw new Error(required);
		const sealed = await readFile(this.config.file).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (sealed === null) return null;
		let value: unknown;
		try {
			value = JSON.parse(this.config.encryption.decryptString(sealed));
		} catch {
			throw new Error(unreadable);
		}
		if (!valid(value)) throw new Error(unreadable);
		return value;
	}
	async save(state: RemoteHostState): Promise<void> {
		if (!this.available()) throw new Error(required);
		const sealed = this.config.encryption.encryptString(JSON.stringify(state)),
			temporary = `${this.config.file}.${randomUUID()}.tmp`;
		await mkdir(dirname(this.config.file), { recursive: true, mode: 0o700 });
		await writeFile(temporary, sealed, { mode: 0o600 });
		await rename(temporary, this.config.file);
	}
	async clear(): Promise<void> {
		await unlink(this.config.file).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
		});
	}
}
