// @harness-uid u_3kkfli5otz
import type {
	DevicePairingInput,
	PendingPairing,
	DeviceCredentials
} from './DevicePairingService.types';
import { DevicePairingError } from './DevicePairingService.types';
import type {
	RelayPairingExchange,
	RelayPairingRequest,
	RelayPairingPoll,
	RelayPairingState
} from '../../../models/networking-security/RemoteRelay.types';
import type {
	PairingApproval,
	PairingSecret,
	RemoteKeyPair
} from '../../../models/networking-security/RemoteSecure.types';
import {
	openPairing,
	pairingEnvelope,
	sealPairing
} from '../../../utils/networking-security/pairingEnvelope';
import { relayOrigin } from '../../../utils/networking-security/relayOrigin';
import {
	fromBase64Url,
	randomBytes,
	toBase64Url
} from '../../../utils/networking-security/remoteBytes';
import {
	normalizeCode,
	pkceChallenge,
	remoteIdentity
} from '../../../utils/networking-security/remoteIdentity';
import { remotePatterns } from '../../../utils/networking-security/remoteIdentity';
import {
	exportRemoteKeys,
	remoteKeys,
	sharedSecret
} from '../../../utils/networking-security/remoteKeys';

/** The phone's side of pairing, as the native app implements it: reference and test client. */
export class DevicePairingService {
	constructor(private readonly options: { fetch?: typeof fetch } = {}) {}
	/** The account port obtained the exact host key and submits under a verified Hub session. */
	requestAccount(
		input: DevicePairingInput,
		hostKey: string,
		submit: (body: RelayPairingRequest) => Promise<void>,
		keys?: RemoteKeyPair
	): Promise<PendingPairing> {
		if (input.code !== '') throw new DevicePairingError('An account connection takes no code.');
		return this.sealRequest(input, hostKey, submit, keys);
	}

	private async sealRequest(
		input: DevicePairingInput,
		publicKey: string,
		submit: (body: RelayPairingRequest) => Promise<unknown>,
		keys?: RemoteKeyPair
	): Promise<PendingPairing> {
		const { hostId, pairingId } = input;
		const origin = relayOrigin(input.origin);
		if (!origin || !remotePatterns.pairingId.test(pairingId))
			throw new DevicePairingError('The computer connection is invalid.');
		if (typeof publicKey !== 'string' || (await remoteIdentity(publicKey)) !== hostId)
			throw new DevicePairingError('The relay did not present the key of this computer.');
		const device = keys ?? (await remoteKeys()),
			ephemeral = await remoteKeys(),
			hostKey = fromBase64Url(publicKey),
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
		await submit(body);
		const deviceId = await remoteIdentity(device.publicKey);
		const held = { keys: device, hostKey: publicKey, deviceId, verifier };
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
			throw new DevicePairingError('The approval is not for this device.');
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
		if (!response.ok) throw new DevicePairingError('The pairing was refused or has expired.');
		return (await response.json()) as unknown;
	}
}

export type {
	DevicePairingInput,
	PendingPairing,
	DeviceCredentials
} from './DevicePairingService.types';
