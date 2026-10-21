import { expect, test } from 'vitest';
import { importRemoteKeys, remoteIdentity, remotePatterns } from '../../../remote/src/index';
import { remoteHostIdentity } from '../../src/services/remote-host-switch-service/remoteHostIdentity';

test('a new host identity is off, self-certifying and unlike any other', async () => {
	const identity = await remoteHostIdentity(),
		other = await remoteHostIdentity();
	expect(identity).toMatchObject({ enabled: false, origin: null, devices: [], revoked: [] });
	expect(identity.hostId).toBe(await remoteIdentity(identity.keys.publicKey));
	expect(identity.credential).toMatch(remotePatterns.credential);
	expect((await importRemoteKeys(identity.keys)).publicKey).toHaveLength(65);
	expect(other.hostId).not.toBe(identity.hostId);
	expect(other.credential).not.toBe(identity.credential);
});
