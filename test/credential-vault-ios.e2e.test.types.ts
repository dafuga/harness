import type { vaultBroker } from './support/credential-vault/broker';
import type { remoteInbox } from './support/credential-vault/remoteInbox';

export interface NativeVaultTestRun {
	fixture: ReturnType<typeof vaultBroker>;
	phone: { write<T>(body: unknown): Promise<T> };
	inbox: Awaited<ReturnType<typeof remoteInbox>>;
}
