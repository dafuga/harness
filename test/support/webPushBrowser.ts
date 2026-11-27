import {
	createDecipheriv,
	createECDH,
	createHmac,
	createPublicKey,
	randomBytes,
	verify
} from 'node:crypto';

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const expand = (key: Buffer, info: string | Buffer, length: number) =>
	hmac(key, Buffer.concat([Buffer.from(info), Buffer.from([1])])).subarray(0, length);

/** The receiving half of RFC 8291, as a subscribed browser does it. */
export function webPushBrowser(endpoint: string) {
	const keys = createECDH('prime256v1');
	keys.generateKeys();
	const auth = randomBytes(16);
	return {
		target: {
			endpoint,
			keys: {
				p256dh: keys.getPublicKey().toString('base64url'),
				auth: auth.toString('base64url')
			}
		},
		open(body: Buffer): unknown {
			const salt = body.subarray(0, 16);
			const serverKey = body.subarray(21, 21 + body[20]);
			const info = Buffer.concat([Buffer.from('WebPush: info\0'), keys.getPublicKey(), serverKey]);
			const prk = hmac(salt, expand(hmac(auth, keys.computeSecret(serverKey)), info, 32));
			const decipher = createDecipheriv(
				'aes-128-gcm',
				expand(prk, 'Content-Encoding: aes128gcm\0', 16),
				expand(prk, 'Content-Encoding: nonce\0', 12)
			);
			const sealed = body.subarray(21 + body[20]);
			decipher.setAuthTag(sealed.subarray(-16));
			const record = Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]);
			return JSON.parse(record.subarray(0, record.lastIndexOf(2)).toString());
		}
	};
}

/** Checks an ES256 token against a base64url uncompressed public key and returns its claims. */
export function verifiedClaims(token: string, publicKey: string) {
	const [header, claims, signature] = token.split('.');
	const point = Buffer.from(publicKey, 'base64url');
	const key = createPublicKey({
		format: 'jwk',
		key: {
			kty: 'EC',
			crv: 'P-256',
			x: point.subarray(1, 33).toString('base64url'),
			y: point.subarray(33, 65).toString('base64url')
		}
	});
	const valid = verify(
		'sha256',
		Buffer.from(`${header}.${claims}`),
		{ key, dsaEncoding: 'ieee-p1363' },
		Buffer.from(signature, 'base64url')
	);
	if (!valid) throw new Error('bad signature');
	const read = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());
	return { header: read(header), claims: read(claims) };
}
