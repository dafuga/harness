import { expect } from 'vitest';
import { verifiedClaims, webPushBrowser } from './webPushBrowser';

export const hubOrigin = 'https://hub.example.test';
export const macPush = 'https://fcm.googleapis.com/fcm/send/mac';
export const phonePush = 'https://web.push.apple.com/phone';

/**
 * A synthetic Hub and push service. Both check the sender's signature, and each delivered
 * message is decrypted with the receiving browser's own key, as the browser would.
 */
export function webPushWorld(publicKey: string) {
	const browsers = [webPushBrowser(macPush), webPushBrowser(phonePush)];
	const world = {
		quiet: { enabled: true, start: '22:00', end: '08:00' },
		subscribed: 2,
		status: new Map<string, number>(),
		hubRequests: [] as { method: string; body: unknown }[],
		shown: [] as { endpoint: string; message: unknown }[]
	};
	const hub = (init: RequestInit, authorization: string) => {
		const { header, claims } = verifiedClaims(authorization.replace('Bearer ', ''), publicKey);
		expect(header.typ).toBe('harness-push-sender+jwt');
		expect(claims).toMatchObject({ aud: hubOrigin, sub: 'harness-push-sender' });
		const body = init.body ? JSON.parse(String(init.body)) : null;
		world.hubRequests.push({ method: init.method!, body });
		const subscriptions = browsers.slice(0, world.subscribed).map(({ target }) => target);
		return Response.json({ quiet: world.quiet, subscriptions });
	};
	const push = (url: string, init: RequestInit, headers: Record<string, string>) => {
		const token = /^vapid t=([^,]+), k=(.+)$/.exec(headers.authorization)!;
		expect(token[2]).toBe(publicKey);
		expect(verifiedClaims(token[1], publicKey).claims.aud).toBe(new URL(url).origin);
		expect(headers['content-encoding']).toBe('aes128gcm');
		const status = world.status.get(url) ?? 201;
		const browser = browsers.find(({ target }) => target.endpoint === url)!;
		if (status === 201)
			world.shown.push({
				endpoint: url,
				message: browser.open(Buffer.from(init.body as Uint8Array))
			});
		return new Response(null, { status });
	};
	return {
		world,
		async fetch(url: string, init: RequestInit) {
			const headers = init.headers as Record<string, string>;
			if (url === `${hubOrigin}/api/push/sender`) return hub(init, headers.authorization);
			return push(url, init, headers);
		}
	};
}
