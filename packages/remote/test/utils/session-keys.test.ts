import { expect, test } from 'vitest';
import { SecureFailure } from '../../src/models/RemoteSecure.types';
import { bytesText, fromBase64Url, remoteBytes } from '../../src/utils/remoteBytes';
import { importRemoteKeys, remoteKeys } from '../../src/utils/remoteKeys';
import { openPacket, sealPacket } from '../../src/utils/sealPacket';
import { sessionKeys } from '../../src/utils/sessionKeys';
import type { SessionKeyInput } from '../../src/utils/sessionKeys';
import { vectors } from '../support/vectors';

async function inputs() {
	const [hostStatic, deviceStatic, hostEphemeral, deviceEphemeral] = await Promise.all(
		[vectors.hostStatic, vectors.deviceStatic, vectors.hostEphemeral, vectors.deviceEphemeral].map(
			importRemoteKeys
		)
	);
	const common = {
		hostId: vectors.hostId,
		deviceId: vectors.deviceId,
		generation: vectors.generation,
		deviceNonce: fromBase64Url(vectors.deviceNonce),
		hostNonce: fromBase64Url(vectors.hostNonce)
	};
	const device: SessionKeyInput = {
		...common,
		role: 'device',
		staticKey: deviceStatic,
		ephemeralKey: deviceEphemeral,
		peerStatic: hostStatic.publicKey,
		peerEphemeral: hostEphemeral.publicKey
	};
	const host: SessionKeyInput = {
		...common,
		role: 'host',
		staticKey: hostStatic,
		ephemeralKey: hostEphemeral,
		peerStatic: deviceStatic.publicKey,
		peerEphemeral: deviceEphemeral.publicKey
	};
	return { device, host };
}
const first = vectors.session.packets[0];

test('device and host derive mirrored keys that reproduce the frozen packets', async () => {
	const input = await inputs(),
		device = await sessionKeys(input.device),
		host = await sessionKeys(input.host);
	for (const packet of vectors.session.packets) {
		const { direction, counter, more } = packet,
			fromDevice = direction === 'd2h';
		const context = { direction, counter, more };
		const send = fromDevice ? device.send : host.send,
			receive = fromDevice ? host.receive : device.receive;
		expect(await sealPacket({ ...context, key: send }, remoteBytes(packet.plaintext))).toBe(
			packet.data
		);
		expect(bytesText(await openPacket({ ...context, key: receive }, packet.data))).toBe(
			packet.plaintext
		);
	}
});
test('any change of the transcript gives keys that cannot open the packets', async () => {
	const { host } = await inputs();
	const changed: SessionKeyInput[] = [
		{ ...host, generation: host.generation + 1 },
		{ ...host, hostId: 'f'.repeat(40) },
		{ ...host, deviceId: 'e'.repeat(40) },
		{ ...host, hostNonce: host.deviceNonce }
	];
	for (const input of changed) {
		const keys = await sessionKeys(input);
		await expect(
			openPacket({ key: keys.receive, direction: 'd2h', counter: 0, more: false }, first.data)
		).rejects.toBeInstanceOf(SecureFailure);
	}
});
test('a host without the pinned static key derives keys that open nothing', async () => {
	const { host } = await inputs(),
		keys = await sessionKeys({ ...host, staticKey: await remoteKeys() });
	await expect(
		openPacket({ key: keys.receive, direction: 'd2h', counter: 0, more: false }, first.data)
	).rejects.toBeInstanceOf(SecureFailure);
});
