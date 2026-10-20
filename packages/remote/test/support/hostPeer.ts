import type { SecurePacket } from '../../src/models/RemoteSecure.types';
import type { DeviceCredentials } from '../../src/services/device-pairing-service/DevicePairingService';
import { SecureChannelService } from '../../src/services/secure-channel-service/SecureChannelService';
import type { WireLink } from '../../src/services/wire-session-service/WireSessionService';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { randomCredential, remoteIdentity } from '../../src/utils/remoteIdentity';
import { exportRemoteKeys, remoteKeys } from '../../src/utils/remoteKeys';
import { SecurePacketValidator } from '../../src/validators/SecurePacketValidator';
import { memorySocket } from './memorySocket';
import { wireSession } from './wireHarness';

/** The host end of one device connection: secure channel plus a wire session, no relay. */
export async function hostPeer(options: { reject?: boolean } = {}) {
	const hostKeys = await remoteKeys(),
		deviceKeys = await remoteKeys();
	const hostId = await remoteIdentity(hostKeys.publicKey),
		deviceId = await remoteIdentity(deviceKeys.publicKey);
	const { session, calls } = wireSession(),
		pipe = memorySocket(),
		validator = new SecurePacketValidator();
	let channel: SecureChannelService | null = null,
		link: WireLink | null = null;
	const out = (packet: SecurePacket) => pipe.toDevice(JSON.stringify(packet));
	async function hello(packet: SecurePacket) {
		if (options.reject) return out({ type: 'reject', reason: 'revoked' });
		const next = new SecureChannelService({
			role: 'host',
			hostId,
			deviceId,
			staticKey: hostKeys,
			peerKey: deviceKeys.publicKey,
			generation: 1
		});
		channel = next;
		link = session.connect((text) => void next.seal(text, out));
		return out(await next.answer(packet));
	}
	pipe.onDevice((text) => {
		if (text === 'ping') return pipe.toDevice('pong');
		const packet = validator.text(text);
		if (packet.type === 'hello') return void hello(packet);
		void channel?.open(packet).then((opened) => (opened === null ? null : link?.receive(opened)));
	});
	const credentials: DeviceCredentials = {
		origin: 'https://relay.example',
		hostId,
		hostKey: toBase64Url(hostKeys.publicKey),
		hostName: 'Fixture Mac',
		deviceId,
		credential: randomCredential(),
		keys: await exportRemoteKeys(deviceKeys),
		generation: 1,
		grant: { projects: [], agents: true }
	};
	return { pipe, session, calls, credentials, hostId, deviceId };
}
