// @harness-uid u_23yfiktdqa
import type { SealedDeviceKeys } from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import type {
	SealedDeviceSessionState,
	SealedSessionRequest
} from './readSealedDeviceSession.types';
import { cryptoSource, fromBase64Url, remoteBytes, toBase64Url } from './remoteBytes';

const path = '/api/sync/v1/device-session';

/** Reads the current Google session's device stage and completes its key proof when requested. */
export async function readSealedDeviceSession(
	request: SealedSessionRequest,
	device: SealedDeviceKeys,
	signal?: AbortSignal,
	verifyApproval?: () => Promise<void>
): Promise<SealedDeviceSessionState> {
	const headers = { 'X-Harness-Device': device.deviceId };
	const options = { cache: 'no-store', redirect: 'error', signal } as const;
	const status = await read(await request(path, { ...options, method: 'GET', headers }));
	if (status.state === 'first-device' || status.state === 'waiting-for-approval')
		return status.state;
	if (status.state === 'approved') {
		await verifyApproval?.();
		signal?.throwIfAborted();
		return status.state;
	}
	const challenge = status.challenge;
	if (status.state !== 'proof-required' || !validChallenge(challenge))
		throw new SealedError('Hub returned an invalid device approval stage.');
	await verifyApproval?.();
	const signature = await signChallenge(device, challenge);
	signal?.throwIfAborted();
	const confirmed = await read(
		await request(path, {
			...options,
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ challenge, signature })
		})
	);
	if (confirmed.state !== 'approved') throw new SealedError('Hub did not confirm device approval.');
	return 'approved';
}

async function read(response: Response): Promise<Record<string, unknown>> {
	if (!response.ok) throw new SealedError('Hub refused the device session request.');
	const value: unknown = await response.json();
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new SealedError('Hub returned an invalid device session response.');
	return value as Record<string, unknown>;
}

function validChallenge(value: unknown): value is string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
	const decoded = fromBase64Url(value);
	return decoded.length === 32 && toBase64Url(decoded) === value;
}

async function signChallenge(device: SealedDeviceKeys, challenge: string): Promise<string> {
	const message = remoteBytes('harness/sealed/v1/session\0' + challenge);
	const signed = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		device.signing.privateKey,
		cryptoSource(message)
	);
	return toBase64Url(new Uint8Array(signed));
}
