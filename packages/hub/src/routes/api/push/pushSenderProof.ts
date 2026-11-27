import { importJWK, jwtVerify } from 'jose';
import { webPushContract } from '../../../../../../src/utils/projects-sessions/webPushContract';
import type { PushSenderProof } from './pushSenderProof.types';

const coordinate = (point: Uint8Array) =>
	btoa(String.fromCharCode(...point))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');

/**
 * The sender proves it holds the private half of the configured public key. The token's type,
 * subject and audience keep a VAPID token seen by a push service from working here.
 */
export async function verifiedSender(
	request: Request,
	{ publicKey, origin, now }: PushSenderProof
): Promise<boolean> {
	const token = /^Bearer ([A-Za-z0-9_.-]{1,2048})$/.exec(
		request.headers.get('authorization') ?? ''
	)?.[1];
	if (!token) return false;
	try {
		const point = Uint8Array.from(
			atob(publicKey.replaceAll('-', '+').replaceAll('_', '/')),
			(character) => character.charCodeAt(0)
		);
		const key = await importJWK(
			{
				kty: 'EC',
				crv: 'P-256',
				x: coordinate(point.slice(1, 33)),
				y: coordinate(point.slice(33, 65))
			},
			'ES256'
		);
		await jwtVerify(token, key, {
			algorithms: ['ES256'],
			audience: origin,
			subject: webPushContract.senderSubject,
			typ: webPushContract.senderTokenType,
			maxTokenAge: '3m',
			// The sender's computer and the Hub never agree to the second.
			clockTolerance: 60,
			requiredClaims: ['exp', 'iat'],
			currentDate: new Date(now)
		});
		return true;
	} catch {
		return false;
	}
}
