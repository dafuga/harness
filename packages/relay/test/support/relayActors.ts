import { expect } from 'vitest';
import {
	credentialHash,
	pkceChallenge,
	randomBytes,
	randomCredential,
	randomId,
	relayHeaders,
	remoteIdentity,
	toBase64Url
} from '../../../remote/src/index';
import type { RelayFixture } from './relayFixture';
import { RelaySocket, type Frame } from './relaySocket';

export interface TestHost {
	ownerId: string;
	hostId: string;
	hostKey: string;
	credential: string;
	name: string;
}
export interface TestDevice {
	deviceId: string;
	credential: string;
}
/** A pairing a phone asked for: what it sent, and the verifier only the phone knows. */
export interface TestRequest {
	pairingId: string;
	verifier: string;
	body: { ephemeralKey: string; sealed: string; challenge: string };
}

/** A fresh P-256 public key and the id it certifies. */
export async function newIdentity(): Promise<{ id: string; key: string }> {
	const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	]);
	const key = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
	return { id: await remoteIdentity(key), key };
}

export function sealedText(bytes = 96): string {
	return toBase64Url(randomBytes(bytes));
}

/** A host that exists nowhere yet, and the body that registers it. */
export async function newHost(ownerId = `owner-${randomId(4)}`): Promise<TestHost> {
	const identity = await newIdentity();
	return {
		ownerId,
		hostId: identity.id,
		hostKey: identity.key,
		credential: randomCredential(),
		name: 'Test Mac'
	};
}

export async function registration(host: TestHost): Promise<Record<string, unknown>> {
	return {
		owner: { id: host.ownerId },
		hostId: host.hostId,
		hostKey: host.hostKey,
		credentialHash: await credentialHash({
			role: 'host',
			hostId: host.hostId,
			credential: host.credential
		}),
		name: host.name
	};
}

export function ownerOf(host: TestHost): Record<string, unknown> {
	return { owner: { id: host.ownerId }, hostId: host.hostId };
}

/** Registers a new host through the namespace binding. */
export async function registerHost(relay: RelayFixture, ownerId?: string): Promise<TestHost> {
	const host = await newHost(ownerId);
	const response = await relay.manage('register', await registration(host));
	expect(response.status, 'registration through the binding').toBe(200);
	return host;
}

export function hostHeaders(host: TestHost): Record<string, string> {
	return { Authorization: `Bearer ${host.credential}`, [relayHeaders.role]: 'host' };
}

export function deviceHeaders(device: TestDevice): Record<string, string> {
	return {
		Authorization: `Bearer ${device.credential}`,
		[relayHeaders.role]: 'device',
		[relayHeaders.device]: device.deviceId
	};
}

export function connectUrl(relay: RelayFixture, hostId: string): string {
	return `${relay.socketOrigin}/v1/hosts/${hostId}/connect`;
}

/** Opens the host socket and reads its `ready` frame. */
export async function connectHost(relay: RelayFixture, host: TestHost): Promise<RelaySocket> {
	const socket = await RelaySocket.open(connectUrl(relay, host.hostId), hostHeaders(host));
	const ready = await socket.next();
	expect(ready.type, 'the first frame of a host socket').toBe('ready');
	return socket;
}

/**
 * Opens a device socket. It pings once: workerd ends a closed socket at once only when its
 * client has sent something before, and takes ten seconds otherwise.
 */
export async function connectDevice(
	relay: RelayFixture,
	host: TestHost,
	device: TestDevice
): Promise<RelaySocket> {
	const socket = await RelaySocket.open(connectUrl(relay, host.hostId), deviceHeaders(device));
	socket.send('ping');
	expect(await socket.text(), 'the answer to the first ping of a device').toBe('pong');
	return socket;
}

/** Sends a host command and returns its acknowledgement. */
export async function command(socket: RelaySocket, body: Frame): Promise<Frame> {
	const ref = randomId(4);
	socket.send({ ...body, ref });
	for (;;) {
		const frame = await socket.until('ack');
		if (frame.ref === ref) return frame;
	}
}

export function pairingPath(host: TestHost, pairingId: string, action = ''): string {
	return `/v1/hosts/${host.hostId}/pairings/${pairingId}${action ? `/${action}` : ''}`;
}

/** The host opens a pairing that lives for `ttlMs`. */
export async function openPairing(socket: RelaySocket, ttlMs = 60_000): Promise<string> {
	const pairingId = randomId();
	const expiresAt = new Date(Date.now() + ttlMs).toISOString();
	const ack = await command(socket, { type: 'pairing-open', pairingId, expiresAt });
	expect(ack, 'pairing-open').toMatchObject({ ok: true });
	return pairingId;
}

export async function newRequest(pairingId: string): Promise<TestRequest> {
	const verifier = randomCredential();
	const body = {
		ephemeralKey: (await newIdentity()).key,
		sealed: sealedText(),
		challenge: await pkceChallenge(verifier)
	};
	return { pairingId, verifier, body };
}

/** A phone asks to be paired; the host socket reads the request it is forwarded. */
export async function requestPairing(
	relay: RelayFixture,
	host: TestHost,
	socket: RelaySocket,
	ttlMs?: number
): Promise<TestRequest> {
	const request = await newRequest(await openPairing(socket, ttlMs));
	const response = await relay.post(pairingPath(host, request.pairingId, 'request'), request.body);
	expect(response.status, 'pairing request').toBe(202);
	await socket.until('pairing-request');
	return request;
}

/** The whole pairing: request, approval by the host, exchange for a credential. */
export async function pairDevice(
	relay: RelayFixture,
	host: TestHost,
	socket: RelaySocket,
	deviceId?: string
): Promise<TestDevice> {
	const request = await requestPairing(relay, host, socket);
	const approved = deviceId ?? (await newIdentity()).id;
	const { challenge } = request.body,
		approval = {
			pairingId: request.pairingId,
			deviceId: approved,
			sealed: sealedText(),
			challenge
		};
	const ack = await command(socket, { type: 'pairing-approve', ...approval });
	expect(ack, 'pairing-approve').toMatchObject({ ok: true });
	const response = await relay.post(pairingPath(host, request.pairingId, 'exchange'), {
		verifier: request.verifier
	});
	expect(response.status, 'pairing exchange').toBe(200);
	const exchanged = (await response.json()) as TestDevice;
	return { deviceId: exchanged.deviceId, credential: exchanged.credential };
}

/** Opens a device socket and returns it with the connection id the host was told. */
export async function openDevice(
	relay: RelayFixture,
	host: TestHost,
	pairing: { device: TestDevice; socket: RelaySocket }
): Promise<{ socket: RelaySocket; connectionId: string }> {
	const socket = await connectDevice(relay, host, pairing.device);
	const opened = await pairing.socket.until('device-open');
	return { socket, connectionId: String(opened.connectionId) };
}
