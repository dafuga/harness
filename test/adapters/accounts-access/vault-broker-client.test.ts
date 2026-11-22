import { join } from 'node:path';
import { expect, test } from 'vitest';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { withTempDir } from '../../support/temporary';

test('an absent broker socket is reported as unreachable', async () => {
	await withTempDir('vault-client-', async (directory) => {
		const client = new VaultBrokerClientAdapter({ socketPath: join(directory, 'missing.sock') });
		await expect(client.call('/v1/session/status', {})).rejects.toMatchObject({
			status: 503,
			message: 'The Credential Vault broker is not reachable.'
		});
	});
});
