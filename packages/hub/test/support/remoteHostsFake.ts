type Json = Record<string, unknown>;

export interface ManageCall {
	/** The name the object id was derived from. */
	name: string;
	url: string;
	method: string;
	contentType: string | null;
	body: Json;
}

interface FakeDevice {
	deviceId: string;
	online: boolean;
	createdAt: string;
	lastSeenAt: string | null;
}

interface FakeHost {
	ownerId: string;
	hostKey: string;
	credentialHash: string;
	name: string;
	generation: number;
	registeredAt: string;
	devices: FakeDevice[];
}

export interface RemoteHostsFake {
	namespace: DurableObjectNamespace;
	/** Every request that reached the binding, in order. */
	calls: ManageCall[];
	hosts: Map<string, FakeHost>;
	/** Replace the relay's answer, or throw from it, to stand in for a broken relay. */
	respond: ((call: ManageCall) => Response | Promise<Response>) | null;
	addDevice(hostId: string, deviceId: string): void;
}

export const REGISTERED_AT = '2026-10-12T09:00:00.000Z';
const HEX40 = /^[a-f0-9]{40}$/;

const reply = (value: unknown, status = 200) => Response.json(value, { status });
const refuse = (error: string, status: number) => reply({ error }, status);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function ownerOf(body: Json): string | null {
	const owner = body.owner as { id?: unknown } | null | undefined;
	return owner && typeof owner === 'object' && text(owner.id) ? owner.id : null;
}

function register(hosts: Map<string, FakeHost>, body: Json, ownerId: string): Response {
	const hostId = String(body.hostId);
	const known = hosts.get(hostId);
	if (![body.hostKey, body.credentialHash, body.name].every(text))
		return refuse('invalid-input', 400);
	if (known && known.ownerId !== ownerId) return refuse('forbidden', 403);
	const host: FakeHost = {
		ownerId,
		hostKey: String(body.hostKey),
		credentialHash: String(body.credentialHash),
		name: String(body.name),
		generation: (known?.generation ?? 0) + 1,
		registeredAt: REGISTERED_AT,
		devices: known?.devices ?? []
	};
	hosts.set(hostId, host);
	return reply({ hostId, generation: host.generation, registeredAt: host.registeredAt });
}

function summary(hostId: string, host: FakeHost): Response {
	const { name, generation, registeredAt } = host;
	const devices = host.devices.map((device) => ({ ...device }));
	return reply({ hostId, name, online: false, generation, registeredAt, devices });
}

function revoke(host: FakeHost, body: Json): Response {
	if (!HEX40.test(String(body.deviceId))) return refuse('invalid-input', 400);
	const index = host.devices.findIndex((device) => device.deviceId === body.deviceId);
	if (index < 0) return refuse('not-found', 404);
	host.devices.splice(index, 1);
	return reply({ ok: true });
}

function wellFormed(call: ManageCall, ownerId: string | null): ownerId is string {
	const named = call.body.hostId === call.name && HEX40.test(call.name);
	return call.method === 'POST' && ownerId !== null && named;
}

/** The relay's `/manage/*` contract: owner check first, `403` for another owner, `404` unknown. */
function manage(hosts: Map<string, FakeHost>, call: ManageCall): Response {
	const operation = new URL(call.url).pathname.replace('/manage/', '');
	const ownerId = ownerOf(call.body);
	if (!wellFormed(call, ownerId)) return refuse('invalid-input', 400);
	if (operation === 'register') return register(hosts, call.body, ownerId);
	const host = hosts.get(call.name);
	if (!host) return refuse('not-found', 404);
	if (host.ownerId !== ownerId) return refuse('forbidden', 403);
	if (operation === 'summary') return summary(call.name, host);
	if (operation === 'revoke-device') return revoke(host, call.body);
	if (operation !== 'unregister') return refuse('not-found', 404);
	hosts.delete(call.name);
	return reply({ ok: true });
}

function recorded(name: string, url: string, init: RequestInit = {}): ManageCall {
	return {
		name,
		url,
		method: init.method ?? 'GET',
		contentType: new Headers(init.headers).get('Content-Type'),
		body: JSON.parse(String(init.body ?? '{}')) as Json
	};
}

/** `REMOTE_HOSTS` in memory: one object per name, every forwarded request kept for assertions. */
export function remoteHostsFake(): RemoteHostsFake {
	const hosts = new Map<string, FakeHost>();
	const fake: RemoteHostsFake = {
		namespace: null as unknown as DurableObjectNamespace,
		calls: [],
		hosts,
		respond: null,
		addDevice(hostId, deviceId) {
			const device = { deviceId, online: true, createdAt: REGISTERED_AT, lastSeenAt: null };
			hosts.get(hostId)?.devices.push(device);
		}
	};
	const stub = (name: string) => ({
		async fetch(url: string, init?: RequestInit) {
			const call = recorded(name, url, init);
			fake.calls.push(call);
			return fake.respond ? fake.respond(call) : manage(hosts, call);
		}
	});
	fake.namespace = {
		idFromName: (name: string) => ({ name }),
		get: (id: { name: string }) => stub(id.name)
	} as unknown as DurableObjectNamespace;
	return fake;
}
