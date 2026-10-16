import { randomBytes, toBase64Url } from '../../../remote/src/index';
import { newIdentity } from './relayActors';
import type { Frame } from './relaySocket';

/** Contract packets (§4.1) with random but well-formed contents. The relay never opens them. */
export async function helloPacket(deviceId: string): Promise<Frame> {
	return {
		type: 'hello',
		version: 1,
		deviceId,
		ephemeralKey: (await newIdentity()).key,
		nonce: toBase64Url(randomBytes(16))
	};
}

export async function acceptPacket(generation = 1): Promise<Frame> {
	return {
		type: 'accept',
		version: 1,
		ephemeralKey: (await newIdentity()).key,
		nonce: toBase64Url(randomBytes(16)),
		generation
	};
}

export function sealedPacket(counter = 0, bytes = 64): Frame {
	return { type: 'sealed', counter, more: false, data: toBase64Url(randomBytes(bytes)) };
}
