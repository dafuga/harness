// @harness-uid u_ydbpwntlfp
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { VaultBrokerServerAdapter } from '../../adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { VaultDevice } from '../../repositories/accounts-access/VaultDeviceRepository.types';
import { VaultBrokerService } from '../../services/accounts-access/VaultBrokerService';
import { VaultLeaseKeeperService } from '../../services/accounts-access/VaultLeaseKeeperService';
import type { CredentialBrokerOptions } from './serveCredentialBroker.types';

/** Starts the broker on its Unix socket and sweeps leases every second until closed. */
export async function serveCredentialBroker(options: CredentialBrokerOptions) {
	const trust = JSON.parse(readFileSync(options.trust, 'utf8')) as { devices: VaultDevice[] };
	const devices = new VaultDeviceRepository(trust.devices, options.origin);
	const audit = new VaultAuditRepository(join(options.state, 'audit'));
	const broker = new VaultBrokerService(devices, audit);
	const keeper = new VaultLeaseKeeperService(broker, audit, join(options.state, 'run'));
	const server = new VaultBrokerServerAdapter({
		broker,
		keeper,
		devices,
		socketPath: options.socket
	});
	await server.listen();
	const timer = setInterval(
		() => keeper.sweep().forEach((plan) => options.onTeardown?.(plan)),
		1_000
	);
	timer.unref();
	return {
		socket: options.socket,
		close: async () => {
			clearInterval(timer);
			await server.close();
		}
	};
}

export type { CredentialBrokerOptions } from './serveCredentialBroker.types';
