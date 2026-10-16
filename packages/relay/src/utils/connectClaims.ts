import { relayHeaders, remotePatterns } from '../../../remote/src/index';
import type { ConnectClaims } from '../models/RelayHost.types';
import { matchesPattern } from './matchesPattern';

const bearer = /^Bearer ([^ ]+)$/i;

/**
 * Role, credential and device of a connect request. They are read from headers and from nowhere
 * else: a credential in a URL is never looked at.
 */
export function connectClaims(headers: Headers): ConnectClaims | undefined {
	const credential = bearer.exec(headers.get('Authorization') ?? '')?.[1];
	if (!matchesPattern(credential, remotePatterns.credential)) return undefined;
	const role = headers.get(relayHeaders.role);
	if (role === 'host') return { role, credential, deviceId: '' };
	const deviceId = headers.get(relayHeaders.device);
	if (role !== 'device' || !matchesPattern(deviceId, remotePatterns.deviceId)) return undefined;
	return { role, credential, deviceId };
}
