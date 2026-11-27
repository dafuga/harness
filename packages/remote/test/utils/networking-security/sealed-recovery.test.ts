import { expect, test } from 'vitest';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../src/utils/networking-security/sealedDevice';
import { openSealedGrant, sealedGrant } from '../../../src/utils/networking-security/sealedGrant';
import {
	newRecoverySecret,
	openSealedRecovery,
	sealedRecovery
} from '../../../src/utils/networking-security/sealedRecovery';
import { toBase64Url } from '../../../src/utils/networking-security/remoteBytes';
import { account, append, sealedAccount } from '../../support/sealedFixture';

test('the recovery secret restores a device that can enroll a new one and read grants', async () => {
	const fixture = await sealedAccount();
	const secret = newRecoverySecret();
	const blob = await sealedRecovery(secret, fixture.recovery);
	expect(blob).not.toContain(toBase64Url(secret));
	const restored = await openSealedRecovery(secret, blob);
	expect(restored.deviceId).toBe(fixture.recovery.deviceId);
	expect(restored.kem.privateKey.extractable).toBe(false);
	const grant = await sealedGrant(
		account,
		fixture.scope,
		sealedDevicePublic(fixture.recovery, 'recovery', [])
	);
	await openSealedGrant(grant, restored, fixture.state);
	const replacement = await sealedDevice();
	const scope = toBase64Url(fixture.scope.scopeId);
	await append(fixture, restored, {
		type: 'enroll',
		device: sealedDevicePublic(replacement, 'admin', [scope])
	});
	expect(fixture.state.devices[replacement.deviceId]!.active).toBe(true);
});

test('a wrong secret or a changed blob does not open', async () => {
	const fixture = await sealedAccount();
	const blob = await sealedRecovery(newRecoverySecret(), fixture.recovery);
	await expect(openSealedRecovery(newRecoverySecret(), blob)).rejects.toThrow('does not open');
	await expect(sealedRecovery(new Uint8Array(16), fixture.recovery)).rejects.toThrow();
	await expect(sealedRecovery(newRecoverySecret(), await sealedDevice())).rejects.toThrow();
});
