import { expect, test } from 'vitest';
import { readSealedDeviceSession } from '../../../src/utils/networking-security/readSealedDeviceSession';
import { sealedDevice } from '../../../src/utils/networking-security/sealedDevice';
import {
	cryptoSource,
	fromBase64Url,
	toBase64Url
} from '../../../src/utils/networking-security/remoteBytes';

test('readSealedDeviceSession reports waiting without posting an approval', async () => {
	const device = await sealedDevice();
	const result = await readSealedDeviceSession(async (path, request) => {
		expect(path).toBe('/api/sync/v1/device-session');
		expect(request.method).toBe('GET');
		expect(new Headers(request.headers).get('x-harness-device')).toBe(device.deviceId);
		return Response.json({ state: 'waiting-for-approval' });
	}, device);
	expect(result).toBe('waiting-for-approval');
});

test('readSealedDeviceSession signs a challenge for the same path and returns the confirmed state', async () => {
	const device = await sealedDevice();
	const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const state = await readSealedDeviceSession(async (path, request) => {
		expect(path).toBe('/api/sync/v1/device-session');
		expect(request.redirect).toBe('error');
		if (request.method === 'GET') return Response.json({ state: 'proof-required', challenge });
		const body = JSON.parse(String(request.body)) as { challenge: string; signature: string };
		expect(body.challenge).toBe(challenge);
		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			device.signing.publicKey,
			cryptoSource(fromBase64Url(body.signature)),
			new TextEncoder().encode('harness/sealed/v1/session\0' + challenge)
		);
		expect(valid).toBe(true);
		return Response.json({ state: 'approved' });
	}, device);
	expect(state).toBe('approved');
});
