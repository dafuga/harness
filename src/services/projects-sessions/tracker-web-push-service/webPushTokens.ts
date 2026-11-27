// @harness-uid u_fqbgu2vf76
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { webPushContract } from '../../../utils/projects-sessions/webPushContract';
import type { WebPushConfig } from './webPush.types';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** The private scalar and the 65-byte uncompressed public point, both base64url. */
export function generateWebPushKeys(): Pick<WebPushConfig, 'publicKey' | 'privateKey'> {
	const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
	const { x, y, d } = privateKey.export({ format: 'jwk' });
	const point = [Buffer.from([4]), Buffer.from(x!, 'base64url'), Buffer.from(y!, 'base64url')];
	return { publicKey: Buffer.concat(point).toString('base64url'), privateKey: d! };
}

function signingKey({ publicKey, privateKey }: WebPushConfig) {
	const point = Buffer.from(publicKey, 'base64url');
	return createPrivateKey({
		format: 'jwk',
		key: {
			kty: 'EC',
			crv: 'P-256',
			x: point.subarray(1, 33).toString('base64url'),
			y: point.subarray(33, 65).toString('base64url'),
			d: privateKey
		}
	});
}

function token(config: WebPushConfig, type: string, claims: Record<string, unknown>) {
	const body = `${encode({ typ: type, alg: 'ES256' })}.${encode(claims)}`;
	const signature = sign('sha256', Buffer.from(body), {
		key: signingKey(config),
		dsaEncoding: 'ieee-p1363'
	});
	return `${body}.${signature.toString('base64url')}`;
}

/** RFC 8292 VAPID for one push service. The contact is the Hub, never a person. */
export function vapidAuthorization(config: WebPushConfig, endpoint: string, now: number): string {
	const jwt = token(config, 'JWT', {
		aud: new URL(endpoint).origin,
		exp: Math.floor(now / 1000) + 3600,
		sub: config.hubOrigin
	});
	return `vapid t=${jwt}, k=${config.publicKey}`;
}

/** Two-minute proof to the Hub. Its type and audience keep it apart from any VAPID token. */
export function hubSenderAuthorization(config: WebPushConfig, now: number): string {
	const issued = Math.floor(now / 1000);
	const claims = {
		aud: config.hubOrigin,
		sub: webPushContract.senderSubject,
		iat: issued,
		exp: issued + 120
	};
	return `Bearer ${token(config, webPushContract.senderTokenType, claims)}`;
}
