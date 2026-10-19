import { expect, test } from 'vitest';
import { SecureFailure } from '../../src/models/RemoteSecure.types';
import type { SecurePacket } from '../../src/models/RemoteSecure.types';
import { SecureChannelService } from '../../src/services/secure-channel-service/SecureChannelService';
import { fromBase64Url } from '../../src/utils/remoteBytes';
import { importRemoteKeys, remoteKeys } from '../../src/utils/remoteKeys';
import { channelPair, sealed } from '../support/channelPair';
import { vectors } from '../support/vectors';

test('after the handshake both directions carry text', async () => {
	const { host, device } = await channelPair();
	expect(host.ready && device.ready).toBe(true);
	const [packet] = await sealed(device, 'héllo host');
	expect(await host.open(packet)).toBe('héllo host');
	const [reply] = await sealed(host, 'hello device');
	expect(await device.open(reply)).toBe('hello device');
});
test('a long message is split into bounded chunks and reassembled', async () => {
	const limits = { chunkBytes: 1000 },
		{ host, device } = await channelPair({ host: limits, device: limits });
	const text = 'é'.repeat(1800),
		packets = await sealed(host, text),
		opened: (string | null)[] = [];
	expect(packets.map((packet) => packet.type === 'sealed' && packet.more)).toEqual([
		true,
		true,
		true,
		false
	]);
	for (const packet of packets) opened.push(await device.open(packet));
	expect(opened).toEqual([null, null, null, text]);
});
test('a replayed packet ends the channel', async () => {
	const { host, device } = await channelPair(),
		[first] = await sealed(device, 'one'),
		[second] = await sealed(device, 'two');
	expect(await host.open(first)).toBe('one');
	await expect(host.open(first)).rejects.toMatchObject({ reason: 'counter' });
	await expect(host.open(second)).rejects.toBeInstanceOf(SecureFailure);
});
test('a skipped or reordered packet is refused', async () => {
	const { host, device } = await channelPair();
	await sealed(device, 'one');
	const [second] = await sealed(device, 'two');
	await expect(host.open(second)).rejects.toMatchObject({ reason: 'counter' });
});
test('tampered ciphertext is refused', async () => {
	const { host, device } = await channelPair(),
		[packet] = await sealed(device, 'payload');
	if (packet.type !== 'sealed') throw new Error('Expected a sealed packet.');
	const data = (packet.data[0] === 'A' ? 'B' : 'A') + packet.data.slice(1);
	await expect(host.open({ ...packet, data })).rejects.toMatchObject({ reason: 'tag' });
});
test('a peer that pinned another key reads nothing, in either direction', async () => {
	const stranger = (await remoteKeys()).publicKey,
		wrongHost = await channelPair({ hostPins: stranger }),
		wrongDevice = await channelPair({ devicePins: stranger });
	const [fromDevice] = await sealed(wrongHost.device, 'secret'),
		[fromHost] = await sealed(wrongDevice.host, 'secret');
	await expect(wrongHost.host.open(fromDevice)).rejects.toMatchObject({ reason: 'tag' });
	await expect(wrongDevice.device.open(fromHost)).rejects.toMatchObject({ reason: 'tag' });
});
test('messages beyond the bound are neither sealed nor reassembled', async () => {
	const small = { chunkBytes: 100, messageBytes: 250 },
		{ host, device } = await channelPair({ host: { chunkBytes: 100 }, device: small });
	await expect(sealed(device, 'x'.repeat(300))).rejects.toMatchObject({ reason: 'size' });
	const packets = await sealed(host, 'x'.repeat(300));
	await device.open(packets[0]);
	await device.open(packets[1]);
	await expect(device.open(packets[2])).rejects.toMatchObject({ reason: 'size' });
});
test('nothing is sealed before the handshake and a hello for another device is refused', async () => {
	const keys = await remoteKeys(),
		base = { hostId: 'a'.repeat(40), deviceId: 'b'.repeat(40), staticKey: keys },
		peerKey = (await remoteKeys()).publicKey;
	const device = new SecureChannelService({ ...base, role: 'device', peerKey }),
		host = new SecureChannelService({ ...base, role: 'host', peerKey, generation: 1 });
	await expect(sealed(device, 'early')).rejects.toMatchObject({ reason: 'state' });
	const hello = await device.hello();
	if (hello.type !== 'hello') throw new Error('Expected a hello packet.');
	await expect(host.answer({ ...hello, deviceId: 'c'.repeat(40) })).rejects.toMatchObject({
		reason: 'packet'
	});
	await expect(device.hello()).rejects.toMatchObject({ reason: 'state' });
});
test('fixed ephemerals reproduce the frozen session packets', async () => {
	const [hostStatic, deviceStatic, hostEphemeral, deviceEphemeral] = await Promise.all(
		[vectors.hostStatic, vectors.deviceStatic, vectors.hostEphemeral, vectors.deviceEphemeral].map(
			importRemoteKeys
		)
	);
	const ids = { hostId: vectors.hostId, deviceId: vectors.deviceId };
	const device = new SecureChannelService({
		...ids,
		role: 'device',
		staticKey: deviceStatic,
		peerKey: hostStatic.publicKey,
		ephemeral: deviceEphemeral,
		nonce: fromBase64Url(vectors.deviceNonce)
	});
	const host = new SecureChannelService({
		...ids,
		role: 'host',
		staticKey: hostStatic,
		peerKey: deviceStatic.publicKey,
		generation: vectors.generation,
		ephemeral: hostEphemeral,
		nonce: fromBase64Url(vectors.hostNonce)
	});
	const hello = await device.hello(),
		accept = await host.answer(hello);
	expect(hello).toMatchObject({ ephemeralKey: vectors.deviceEphemeral.publicKey });
	expect(accept).toMatchObject({ nonce: vectors.hostNonce, generation: vectors.generation });
	await device.accept(accept);
	const [request, ...chunks] = vectors.session.packets,
		expected = (packet: (typeof vectors.session.packets)[number]): SecurePacket => ({
			type: 'sealed',
			counter: packet.counter,
			more: packet.more,
			data: packet.data
		});
	expect(await sealed(device, request.plaintext)).toEqual([expected(request)]);
	expect(await device.open(expected(chunks[0]))).toBeNull();
	expect(await device.open(expected(chunks[1]))).toBe(chunks[0].plaintext + chunks[1].plaintext);
});
