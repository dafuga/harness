// @harness-uid u_ydbpwntlfp
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { VaultBrokerServerAdapter } from '../../adapters/accounts-access/VaultBrokerServerAdapter';
import { PrivateBrowserAgentAdapter } from '../../adapters/execution-runtimes/PrivateBrowserAgentAdapter';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { VaultAuditRepository } from '../../repositories/accounts-access/VaultAuditRepository';
import { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { VaultDevice } from '../../repositories/accounts-access/VaultDeviceRepository.types';
import { VaultBrokerService } from '../../services/accounts-access/VaultBrokerService';
import { VaultLeaseKeeperService } from '../../services/accounts-access/VaultLeaseKeeperService';
import { PrivateBrowserGateService } from '../../services/execution-runtimes/PrivateBrowserGateService';
import { PrivateBrowserPhoneService } from '../../services/execution-runtimes/PrivateBrowserPhoneService';
import type {
	CredentialBrokerOptions,
	PrivateBrowserExecutorOptions,
	PrivateBrowserRuntime
} from './serveCredentialBroker.types';

/** Starts the broker on its Unix socket and sweeps leases every second until closed. */
export async function serveCredentialBroker(options: CredentialBrokerOptions) {
	const trust = JSON.parse(readFileSync(options.trust, 'utf8')) as { devices: VaultDevice[] };
	const devices = new VaultDeviceRepository(trust.devices, options.origin);
	const audit = new VaultAuditRepository(join(options.state, 'audit'));
	const broker = new VaultBrokerService(devices, audit);
	const keeper = new VaultLeaseKeeperService(broker, audit, join(options.state, 'run'));
	const privateBrowser = options.privateBrowserExecutor
		? await preparePrivateBrowser(options.privateBrowserExecutor, devices, trust.devices)
		: undefined;
	const server = new VaultBrokerServerAdapter({
		broker,
		keeper,
		devices,
		privateBrowser: privateBrowser?.delivery,
		socketPath: options.socket
	});
	await listen(server, privateBrowser);
	const timer = setInterval(
		() => keeper.sweep().forEach((plan) => options.onTeardown?.(plan)),
		1_000
	);
	timer.unref();
	let closing: Promise<void> | undefined;
	return {
		socket: options.socket,
		close: () => {
			clearInterval(timer);
			return (closing ??= close(server, privateBrowser));
		}
	};
}

async function preparePrivateBrowser(
	options: PrivateBrowserExecutorOptions,
	devices: VaultDeviceRepository,
	trusted: VaultDevice[]
): Promise<PrivateBrowserRuntime> {
	if (!trusted.some(({ id, role }) => id === options.agent.deviceId && role === 'approver')) {
		throw new ExpectedCliError('The private browser executor requires an enrolled approver.');
	}
	const gate = new PrivateBrowserGateService(options.cleanup);
	if (!(await gate.recover())) {
		throw new ExpectedCliError('The private browser executor could not confirm browser recovery.');
	}
	const delivery = new PrivateBrowserPhoneService({
		devices,
		gate,
		submitField: options.submitField
	});
	const agent = new PrivateBrowserAgentAdapter({
		...options.agent,
		gate,
		nativeEntry: { delivery, reviewedField: options.reviewedField }
	});
	return { gate, delivery, agent };
}

async function listen(server: VaultBrokerServerAdapter, runtime?: PrivateBrowserRuntime) {
	try {
		await server.listen();
	} catch (error) {
		await runtime?.gate.close();
		throw error;
	}
	try {
		await runtime?.agent.listen();
	} catch (error) {
		await close(server, runtime);
		throw error;
	}
}

async function close(server: VaultBrokerServerAdapter, runtime?: PrivateBrowserRuntime) {
	const [disposed] = await Promise.all([
		runtime?.gate.close(),
		runtime?.agent.close(),
		server.close()
	]);
	if (disposed === false) {
		throw new ExpectedCliError('The private browser executor could not confirm browser disposal.');
	}
}

export type { CredentialBrokerOptions } from './serveCredentialBroker.types';
