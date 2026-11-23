import type { VaultDeviceRepository } from '../src/repositories/accounts-access/VaultDeviceRepository';
import type { VaultBrokerService } from '../src/services/accounts-access/VaultBrokerService';
import type { vaultBroker } from './support/credential-vault/broker';

export interface NativeVaultTestRun {
	fixture: ReturnType<typeof vaultBroker>;
	phone: { write<T>(body: unknown): Promise<T> };
	devices: VaultDeviceRepository;
	broker: VaultBrokerService;
}
