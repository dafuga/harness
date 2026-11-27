// @harness-uid u_x3kkbvtisb
import { createCipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
import type { PushSubscriptionTarget } from '../../../utils/projects-sessions/webPushContract.types';
import type { WebPushSeed } from './encryptWebPush.types';

const recordSize = 4096;
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const expand = (key: Buffer, info: Buffer, length: number) =>
	hmac(key, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);

/**
 * RFC 8291 `aes128gcm`: only the subscribed browser can read the result. A seed replaces the
 * random salt and one-time key, to check the output against the published test vector.
 */
export function encryptWebPush(
	plaintext: Buffer,
	browser: PushSubscriptionTarget['keys'],
	seed?: WebPushSeed
): Buffer {
	const { p256dh, auth } = browser;
	const server = createECDH('prime256v1');
	if (seed) server.setPrivateKey(seed.privateKey);
	else server.generateKeys();
	const salt = seed?.salt ?? randomBytes(16);
	const browserKey = Buffer.from(p256dh, 'base64url');
	const serverKey = server.getPublicKey();
	const info = Buffer.concat([Buffer.from('WebPush: info\0'), browserKey, serverKey]);
	const secret = hmac(Buffer.from(auth, 'base64url'), server.computeSecret(browserKey));
	const prk = hmac(salt, expand(secret, info, 32));
	const cipher = createCipheriv(
		'aes-128-gcm',
		expand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
		expand(prk, Buffer.from('Content-Encoding: nonce\0'), 12)
	);
	// One record holds the whole message; 0x02 marks it as the last.
	const record = Buffer.concat([plaintext, Buffer.from([2])]);
	const sealed = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
	return Buffer.concat([header(salt, serverKey), sealed]);
}

function header(salt: Buffer, serverKey: Buffer) {
	const size = Buffer.alloc(5);
	size.writeUInt32BE(recordSize, 0);
	size.writeUInt8(serverKey.length, 4);
	return Buffer.concat([salt, size, serverKey]);
}
