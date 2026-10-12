import type { SecurePacket } from '../../src/models/RemoteSecure.types';
import { SecureChannelService } from '../../src/services/SecureChannelService';
import { remoteIdentity } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';

interface PairOptions {
	hostPins?: Uint8Array;
	devicePins?: Uint8Array;
	host?: { chunkBytes?: number; messageBytes?: number };
	device?: { chunkBytes?: number; messageBytes?: number };
}
/** A device and a host channel with fresh keys, after a completed handshake. */
export async function channelPair(options: PairOptions = {}) {
	const hostKeys = await remoteKeys(),
		deviceKeys = await remoteKeys();
	const hostId = await remoteIdentity(hostKeys.publicKey),
		deviceId = await remoteIdentity(deviceKeys.publicKey);
	const device = new SecureChannelService({
		role: 'device',
		hostId,
		deviceId,
		staticKey: deviceKeys,
		peerKey: options.devicePins ?? hostKeys.publicKey,
		limits: options.device
	});
	const host = new SecureChannelService({
		role: 'host',
		hostId,
		deviceId,
		staticKey: hostKeys,
		peerKey: options.hostPins ?? deviceKeys.publicKey,
		generation: 1,
		limits: options.host
	});
	await device.accept(await host.answer(await device.hello()));
	return { host, device, hostKeys, deviceKeys, hostId, deviceId };
}
export async function sealed(channel: SecureChannelService, text: string): Promise<SecurePacket[]> {
	const packets: SecurePacket[] = [];
	await channel.seal(text, (packet) => packets.push(packet));
	return packets;
}
