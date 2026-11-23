// @harness-uid u_ydbpwntlfp
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { VaultBrokerServerAdapter } from '../../adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultPeerAdapter } from '../../adapters/accounts-access/VaultPeerAdapter';
import { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { VaultDevice } from '../../repositories/accounts-access/VaultDeviceRepository.types';
import { VaultBrokerService } from '../../services/accounts-access/VaultBrokerService';
import { VaultLeaseKeeperService } from '../../services/accounts-access/VaultLeaseKeeperService';
import { VaultRunnerPreflightService } from '../../services/accounts-access/VaultRunnerPreflightService';
import type { VaultExecutorPin } from '../../services/accounts-access/VaultRunnerPreflightService.types';
import type { CredentialBrokerOptions } from './serveCredentialBroker.types';

/** Starts the broker on its Unix socket and sweeps leases every second until closed. */
export async function serveCredentialBroker(options: CredentialBrokerOptions) {
	const trust = JSON.parse(readFileSync(options.trust, 'utf8')) as {
		devices: VaultDevice[];
		executors?: VaultExecutorPin[];
	};
	const devices = new VaultDeviceRepository(trust.devices, options.origin);
	const audit = new VaultAuditRepository(join(options.state, 'audit'));
	const broker = new VaultBrokerService(devices, audit);
	const keeper = new VaultLeaseKeeperService(broker, audit, join(options.state, 'run'));
	const preflight = new VaultRunnerPreflightService(trust.executors ?? []);
	const peer = options.peerAddon && new VaultPeerAdapter({ binary: options.peerAddon });
	const server = new VaultBrokerServerAdapter({
		broker,
		keeper,
		devices,
		preflight,
		peerUid: peer ? (socket) => peer.uid(socket) : undefined,
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

/** Run the local broker until an operator stop, then remove its listening socket. */
export async function waitForCredentialBroker(options: CredentialBrokerOptions): Promise<void> {
	const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
	const served = await serveCredentialBroker({ ...options, onTeardown: print });
	const stopped = Promise.withResolvers<void>();
	process.once('SIGTERM', stopped.resolve);
	process.once('SIGINT', stopped.resolve);
	try {
		print({ listening: served.socket });
		await stopped.promise;
		await served.close();
	} finally {
		process.off('SIGTERM', stopped.resolve);
		process.off('SIGINT', stopped.resolve);
	}
}
