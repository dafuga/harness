import { expect, test } from 'vitest';
import { importRemoteKeys, sharedSecret } from '../../src/utils/remoteKeys';
import { openPairing, pairingEnvelope, sealPairing } from '../../src/utils/pairingEnvelope';
import { vectors } from '../support/vectors';

const { pairing } = vectors;
async function sides(pairingId = pairing.pairingId) {
	const host = await importRemoteKeys(vectors.hostStatic),
		ephemeral = await importRemoteKeys(pairing.ephemeral);
	const base = {
		hostId: vectors.hostId,
		pairingId,
		ephemeralKey: ephemeral.publicKey,
		hostKey: host.publicKey
	};
	return {
		device: await pairingEnvelope({
			...base,
			secret: await sharedSecret(ephemeral.privateKey, host.publicKey)
		}),
		host: await pairingEnvelope({
			...base,
			secret: await sharedSecret(host.privateKey, ephemeral.publicKey)
		})
	};
}

test('device and host derive the same envelope keys and reproduce the frozen envelopes', async () => {
	const { device, host } = await sides(),
		request = JSON.parse(pairing.requestPlain) as unknown,
		approval = JSON.parse(pairing.approvalPlain) as unknown;
	expect(await sealPairing(device.request, 'request', request)).toBe(pairing.requestSealed);
	expect(await openPairing(host.request, 'request', pairing.requestSealed)).toEqual(request);
	expect(await sealPairing(host.approval, 'approval', approval)).toBe(pairing.approvalSealed);
	expect(await openPairing(device.approval, 'approval', pairing.approvalSealed)).toEqual(approval);
});
test('an envelope is bound to its pairing and its purpose', async () => {
	const { host, device } = await sides(),
		other = await sides('1e'.repeat(16));
	await expect(openPairing(other.host.request, 'request', pairing.requestSealed)).rejects.toThrow();
	await expect(openPairing(host.request, 'approval', pairing.requestSealed)).rejects.toThrow();
	await expect(openPairing(host.approval, 'request', pairing.requestSealed)).rejects.toThrow();
	await expect(openPairing(device.request, 'approval', pairing.approvalSealed)).rejects.toThrow();
	await expect(openPairing(host.request, 'request', 'AAAA')).rejects.toThrow();
});
