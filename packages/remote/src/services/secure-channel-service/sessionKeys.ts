import { SessionKeyInput } from '../../utils/sessionKeys';
import type { SessionKeys } from "../../models/RemoteSecure.types.ts";
import { concatBytes, remoteBytes, sha256 } from "../../utils/remoteBytes";
import { aesKey, deriveBytes, sharedSecret } from "../../utils/remoteKeys";

/**
 * Triple Diffie-Hellman over P-256: ephemeral-ephemeral for forward secrecy, and each static key
 * with the other side's ephemeral for mutual authentication. Both roles compute the same three
 * secrets, in the order ee, (device static, host ephemeral), (device ephemeral, host static).
 */
async function secrets(input: SessionKeyInput): Promise<Uint8Array> {
	const { staticKey, ephemeralKey, peerStatic, peerEphemeral } = input,
		device = input.role === 'device';
	const ee = await sharedSecret(ephemeralKey.privateKey, peerEphemeral);
	const ownStatic = await sharedSecret(staticKey.privateKey, peerEphemeral),
		ownEphemeral = await sharedSecret(ephemeralKey.privateKey, peerStatic);
	return device
		? concatBytes(ee, ownStatic, ownEphemeral)
		: concatBytes(ee, ownEphemeral, ownStatic);
}

/** Device static, host static, device ephemeral, host ephemeral: the same order for both roles. */
function points(input: SessionKeyInput): Uint8Array[] {
	const { staticKey, ephemeralKey, peerStatic, peerEphemeral } = input;
	return input.role === 'device'
		? [staticKey.publicKey, peerStatic, ephemeralKey.publicKey, peerEphemeral]
		: [peerStatic, staticKey.publicKey, peerEphemeral, ephemeralKey.publicKey];
}

/** One AES-256-GCM key per direction, bound to both identities, both nonces and the generation. */
export async function sessionKeys(input: SessionKeyInput): Promise<SessionKeys> {
	const label = remoteBytes(
		`harness-remote/v1/session\n${input.hostId}\n${input.deviceId}\n${input.generation}\n`
	);
	const salt = await sha256(
		concatBytes(label, ...points(input), input.deviceNonce, input.hostNonce)
	);
	const okm = await deriveBytes(await secrets(input), salt, 'harness-remote/v1/keys', 64);
	const deviceToHost = await aesKey(okm.subarray(0, 32)),
		hostToDevice = await aesKey(okm.subarray(32));
	return input.role === 'device'
		? { send: deviceToHost, receive: hostToDevice }
		: { send: hostToDevice, receive: deviceToHost };
}
