import { join } from 'node:path';
import { expect } from 'vitest';
import { vaultPhone } from '../../../packages/desktop/src/services/networking-security/remote-host-service/vaultPhone';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { VaultBrokerService } from '../../../src/services/accounts-access/VaultBrokerService';
import type { VaultCreated } from '../../../src/services/accounts-access/VaultBrokerService.types';
import { VaultRunnerPreflightService } from '../../../src/services/accounts-access/VaultRunnerPreflightService';
import type { VaultSessionRequest } from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { origin, sessionUid, type vaultBroker } from './broker';
import { syntheticExecutor } from './executor';

export async function remoteInbox(
	fixture: ReturnType<typeof vaultBroker>,
	deviceId: string,
	signingKey: string
) {
	const now = () => fixture.clock.now;
	const devices = new VaultDeviceRepository(
		[{ id: deviceId, signingKey, role: 'approver' }],
		origin
	);
	const broker = new VaultBrokerService(devices, fixture.audit, now);
	const socketPath = join(fixture.state, 'inbox', 'vault.sock');
	const executor = syntheticExecutor();
	const preflight = new VaultRunnerPreflightService([executor.pin], now);
	const server = new VaultBrokerServerAdapter({
		...fixture,
		broker,
		devices,
		preflight,
		socketPath,
		peerUid: () => sessionUid
	});
	const phone = 'a'.repeat(40);
	const config = { phone, generation: 3, origin, deviceId, socketPath };
	expect(vaultPhone(config, { deviceId: 'b'.repeat(40), generation: 3 })).toBeUndefined();
	expect(vaultPhone(config, { deviceId: phone, generation: 4 })).toBeUndefined();
	const call = vaultPhone(config, { deviceId: phone, generation: 3 });
	if (!call) throw new Error('The enrolled fixture phone has no Vault permission.');
	await server.listen();
	const client = new VaultBrokerClientAdapter({ socketPath });
	return {
		broker,
		call,
		close: () => server.close(),
		create(input: VaultSessionRequest) {
			const issuedAt = now();
			const proof = executor.attest(input, {
				brokerId: preflight.brokerId,
				uid: sessionUid,
				issuedAt,
				expiresAt: issuedAt + 60_000
			});
			return client.call<VaultCreated>('/v1/session/requests', { ...input, preflight: proof });
		}
	};
}
