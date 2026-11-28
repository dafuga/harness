import { importPKCS8, SignJWT } from 'jose';
import type { HubEnv } from '../../../configs/development-tooling/hubEnvConfig.types';
import type { ApnsProviderToken, ApnsSigningKey } from './approvalApnsSender.types';
import type { ApnsApprovalPush } from './syncApprovalPush.types';

const origins = {
	production: 'https://api.push.apple.com',
	sandbox: 'https://api.sandbox.push.apple.com'
};
const topic = 'com.dafuga.harness';
const category = 'harness-device-approval';
const appleId = /^[A-Z0-9]{10}$/;
const payload = JSON.stringify({
	aps: {
		alert: { title: 'Harness', body: 'A device sign-in is ready for review.' },
		sound: 'default',
		category
	}
});
let cached: ApnsProviderToken | undefined;

export function approvalApnsSender(config: HubEnv, now: number): ApnsApprovalPush | undefined {
	const {
		HARNESS_APPROVAL_APNS_TEAM_ID: team,
		HARNESS_APPROVAL_APNS_KEY_ID: id,
		HARNESS_APPROVAL_APNS_PRIVATE_KEY: pem,
		HARNESS_APPROVAL_APNS_ENVIRONMENT: environment
	} = config;
	if (!team || !appleId.test(team) || !id || !appleId.test(id) || !pem) return;
	if (environment !== 'sandbox' && environment !== 'production') return;
	return {
		deliver: (deviceToken) => send(origins[environment], { team, id, pem }, now, deviceToken)
	};
}

async function sign(key: ApnsSigningKey, now: number): Promise<string> {
	const privateKey = await importPKCS8(key.pem, 'ES256');
	return new SignJWT({})
		.setProtectedHeader({ alg: 'ES256', kid: key.id })
		.setIssuer(key.team)
		.setIssuedAt(Math.floor(now / 1000))
		.sign(privateKey);
}

function providerToken(key: ApnsSigningKey, now: number): Promise<string> {
	const window = Math.floor(now / (30 * 60_000));
	if (cached?.id === key.id && cached.team === key.team && cached.window === window)
		return cached.value;
	const value = sign(key, now);
	cached = { id: key.id, team: key.team, window, value };
	void value.catch(() => {
		if (cached?.value === value) cached = undefined;
	});
	return value;
}

async function send(
	origin: string,
	key: ApnsSigningKey,
	now: number,
	device: string
): ReturnType<ApnsApprovalPush['deliver']> {
	try {
		const response = await fetch(origin + '/3/device/' + device, {
			method: 'POST',
			redirect: 'error',
			signal: AbortSignal.timeout(10_000),
			headers: {
				authorization: 'bearer ' + (await providerToken(key, now)),
				'content-type': 'application/json',
				'apns-topic': topic,
				'apns-push-type': 'alert',
				'apns-priority': '10',
				'apns-expiration': String(Math.floor(now / 1000) + 300),
				'apns-collapse-id': category
			},
			body: payload
		});
		await response.body?.cancel();
		if (response.status === 410) return 'gone';
		return response.ok ? 'delivered' : 'failed';
	} catch {
		return 'failed';
	}
}
