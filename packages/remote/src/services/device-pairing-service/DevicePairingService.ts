import type { RemoteGrant } from '../../models/Remote.types.ts';
import type { RemotePairInput } from '../../models/RemoteControl.types.ts';
import type {
	RelayPairingExchange,
	RelayPairingInfo,
	RelayPairingPoll,
	RelayPairingState
} from '../../models/RemoteRelay.types.ts';
import type {
	PairingApproval,
	PairingSecret,
	RemoteKeyPair,
	StoredRemoteKeys
} from '../../models/RemoteSecure.types.ts';
import { openPairing, pairingEnvelope, sealPairing } from '../../utils/pairingEnvelope';
import { readPairingOffer } from './pairingOffer';
import type { OfferReading } from '../../utils/pairingOffer';
import { relayOrigin } from '../../utils/relayOrigin';
import { fromBase64Url, randomBytes, toBase64Url } from '../../utils/remoteBytes';
import { normalizeCode, pkceChallenge, remoteIdentity } from '../../utils/remoteIdentity';
import { remotePatterns } from '../../utils/remoteIdentity';
import { exportRemoteKeys, remoteKeys, sharedSecret } from '../../utils/remoteKeys';

export interface DevicePairingInput extends RemotePairInput {
	platform?: PairingSecret['platform'];
}

/** How a device names itself when it scans: it gives no address and no code. */
export interface ScanningDevice {
	deviceName: string;
	platform?: PairingSecret['platform'];
}

/** What a phone holds between its request and the exchange. Nothing here is sent anywhere. */
export interface PendingPairing {
	input: DevicePairingInput;
	origin: string;
	keys: RemoteKeyPair;
	hostKey: string;
	deviceId: string;
	verifier: string;
	approvalKey: CryptoKey;
}

/** What a paired phone keeps in its key store. */
export interface DeviceCredentials {
	origin: string;
	hostId: string;
	hostKey: string;
	hostName: string;
	deviceId: string;
	credential: string;
	keys: StoredRemoteKeys;
	generation: number;
	grant: RemoteGrant;
}

function checked(input: DevicePairingInput): string {
	const origin = relayOrigin(input.origin),
		name = input.deviceName.trim();
	const valid =
		origin !== null &&
		remotePatterns.hostId.test(input.hostId) &&
		remotePatterns.pairingId.test(input.pairingId) &&
		remotePatterns.code.test(normalizeCode(input.code)) &&
		name.length > 0 &&
		name.length <= 80;
	if (!valid || !origin) throw new Error('Check the pairing details and try again.');
	return origin;
}

/** The phone's side of pairing, as the native app implements it: reference and test client. */
export class DevicePairingService {
	constructor(private readonly options: { fetch?: typeof fetch } = {}) {}
	/**
	 * What the app does with a scanned code. Only a current offer for this build is asked with;
	 * anything else fails by its name, such as `offer-expired`, before a relay hears of it.
	 */
	scanned(text: string, device: ScanningDevice, reading: OfferReading): Promise<PendingPairing> {
		const read = readPairingOffer(text, reading);
		if ('refused' in read) return Promise.reject(new Error(`offer-${read.refused}`));
		return this.request({ ...read.offer, ...device });
	}
	/** Pins the host key by its identifier, then asks with the code sealed to that key. */
	async request(input: DevicePairingInput, keys?: RemoteKeyPair): Promise<PendingPairing> {
		const origin = checked(input),
			{ hostId, pairingId } = input;
		const info = (await this.call({ origin, input }, '')) as RelayPairingInfo;
		if (typeof info.hostKey !== 'string' || (await remoteIdentity(info.hostKey)) !== hostId)
			throw new Error('The relay did not present the key of this computer.');
		const device = keys ?? (await remoteKeys()),
			ephemeral = await remoteKeys(),
			hostKey = fromBase64Url(info.hostKey),
			verifier = toBase64Url(randomBytes(32)),
			challenge = await pkceChallenge(verifier);
		const secret = await sharedSecret(ephemeral.privateKey, hostKey);
		const context = { hostId, pairingId, ephemeralKey: ephemeral.publicKey, hostKey };
		const envelope = await pairingEnvelope({ ...context, secret });
		const sealed = await sealPairing(envelope.request, 'request', {
			code: normalizeCode(input.code),
			deviceKey: toBase64Url(device.publicKey),
			deviceName: input.deviceName.trim(),
			platform: input.platform ?? 'ios',
			challenge
		} satisfies PairingSecret);
		const body = { ephemeralKey: toBase64Url(ephemeral.publicKey), sealed, challenge };
		await this.call({ origin, input }, 'request', body);
		const deviceId = await remoteIdentity(device.publicKey);
		const held = { keys: device, hostKey: info.hostKey, deviceId, verifier };
		return { input, origin, ...held, approvalKey: envelope.approval };
	}
	async poll(pending: PendingPairing): Promise<RelayPairingState> {
		return ((await this.call(pending, 'poll', {})) as RelayPairingPoll).state;
	}
	/** One attempt. The approval must open with this pairing's key and name this device's key. */
	async exchange(pending: PendingPairing): Promise<DeviceCredentials> {
		const { verifier, deviceId, origin, hostKey } = pending;
		const result = (await this.call(pending, 'exchange', { verifier })) as RelayPairingExchange;
		const approval = (await openPairing(
			pending.approvalKey,
			'approval',
			String(result.sealed)
		)) as PairingApproval;
		const mine = result.deviceId === deviceId && approval.deviceId === deviceId;
		if (!mine || !remotePatterns.credential.test(String(result.credential)))
			throw new Error('The approval is not for this device.');
		const { hostName, generation, grant } = approval;
		const identity = { origin, hostId: pending.input.hostId, hostKey, hostName, deviceId };
		const keys = await exportRemoteKeys(pending.keys);
		return { ...identity, credential: result.credential, keys, generation, grant };
	}
	private async call(
		target: { origin: string; input: DevicePairingInput },
		operation: string,
		body?: unknown
	): Promise<unknown> {
		const { hostId, pairingId } = target.input,
			path = `/v1/hosts/${hostId}/pairings/${pairingId}${operation ? '/' + operation : ''}`;
		const init: RequestInit =
			body === undefined
				? { method: 'GET', redirect: 'error' }
				: {
						method: 'POST',
						redirect: 'error',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body)
					};
		const response = await (this.options.fetch ?? fetch)(target.origin + path, init);
		if (!response.ok) throw new Error('The pairing was refused or has expired.');
		return (await response.json()) as unknown;
	}
}
