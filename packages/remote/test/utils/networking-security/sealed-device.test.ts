import { expect, test } from 'vitest';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../src/utils/networking-security/sealedDevice';

test('device private keys are non-extractable and public keys are uncompressed points', async () => {
	const device = await sealedDevice();
	expect(device.kem.privateKey.extractable).toBe(false);
	expect(device.signing.privateKey.extractable).toBe(false);
	expect(device.kemPublic).toHaveLength(65);
	expect(device.signingPublic[0]).toBe(4);
	await expect(crypto.subtle.exportKey('jwk', device.kem.privateKey)).rejects.toThrow();
	expect((await sealedDevice()).deviceId).not.toBe(device.deviceId);
});

test('only an explicitly extractable device can be exported, and the public view sorts scopes', async () => {
	const recovery = await sealedDevice({ extractable: true });
	expect((await crypto.subtle.exportKey('jwk', recovery.kem.privateKey)).d).toBeTypeOf('string');
	expect(sealedDevicePublic(recovery, 'recovery', ['b', 'a']).scopes).toEqual(['a', 'b']);
});
