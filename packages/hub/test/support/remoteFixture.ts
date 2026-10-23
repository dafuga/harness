import type { HostIdentity, RemoteFixtureOptions } from './remoteFixture.types';
import { createECDH, createHash } from 'node:crypto';
import type { Actor } from 'collaboration';
import type { HubEnv } from '../../src/configs/hubEnvConfig';
import { HubApiController } from '../../src/controllers/hub-api-controller/HubApiController';
import { hubRemote } from '../../src/routes/api/[...path]/hubRemote';
import { actor } from './projectionFixture';
import { remoteHostsFake } from './remoteHostsFake';

export const HUB = 'https://fixture.example';
export const RELAY_ORIGIN = 'https://relay.fixture.example';
export const CREDENTIAL_HASH = createHash('sha256').update('synthetic credential').digest('hex');
export const DEVICE_ID = createHash('sha256').update('synthetic device').digest('hex').slice(0, 40);

let issued = 0;

/**
 * A real P-256 public key and the id the contract derives from it: base64url of the 65-byte
 * point, and the first 40 hex characters of its SHA-256. Computed here without the hub's code.
 * Each call gives the next key of a fixed series, so a run is repeatable.
 */
export async function keyIdentity(): Promise<{ id: string; key: string }> {
	const ecdh = createECDH('prime256v1');
	ecdh.setPrivateKey(createHash('sha256').update(`synthetic remote key ${++issued}`).digest());
	const point = ecdh.getPublicKey();
	const id = createHash('sha256').update(point).digest('hex').slice(0, 40);
	return { id, key: point.toString('base64url') };
}

export async function hostIdentity(): Promise<HostIdentity> {
	const { id, key } = await keyIdentity();
	return { hostId: id, hostKey: key };
}

/** A well-formed `POST /api/remote/hosts` body. */
export function registration(host: HostIdentity, overrides: Record<string, unknown> = {}) {
	const { hostId, hostKey } = host;
	return { hostId, hostKey, credentialHash: CREDENTIAL_HASH, name: 'Studio Mac', ...overrides };
}

/** `body` as given when it is a string, else JSON. Without one no content type is sent. */
export function remoteRequest(method: string, path: string, body?: unknown): Request {
	const init: RequestInit = { method };
	if (body !== undefined) {
		init.headers = { 'Content-Type': 'application/json' };
		init.body = typeof body === 'string' ? body : JSON.stringify(body);
	}
	return new Request(`${HUB}/api/remote${path}`, init);
}

/** `201 ok`, `403 forbidden`: the status and the public error code of an answer. */
export async function outcome(response: Response): Promise<string> {
	const body = (await response.json()) as { error?: string } | null;
	return `${response.status} ${body?.error ?? 'ok'}`;
}

/** The hub API with the remote part built from settings, and a relay that lives in memory. */
export function remoteFixture(options: RemoteFixtureOptions = {}) {
	const relay = remoteHostsFake();
	let active: Actor | null = actor;
	const env: HubEnv = {
		HARNESS_RELAY_ORIGIN: RELAY_ORIGIN,
		REMOTE_HOSTS: relay.namespace,
		...options.env
	};
	const controller = new HubApiController({
		auth: options.auth ?? { actor: async () => active, handle: async () => null },
		connect:
			options.connect ??
			(() => {
				throw new Error('remote routes never open collaboration');
			}),
		remote: hubRemote(env)
	});
	return {
		relay,
		controller,
		setActor(next: Actor | null) {
			active = next;
		},
		send: (method: string, path: string, body?: unknown) =>
			controller.handle(remoteRequest(method, path, body))
	};
}

export type { HostIdentity, RemoteFixtureOptions, RemoteFixture } from './remoteFixture.types';
