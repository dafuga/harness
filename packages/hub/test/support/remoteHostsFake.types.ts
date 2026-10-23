export type Json = Record<string, unknown>;

export interface ManageCall {
	/** The name the object id was derived from. */
	name: string;
	url: string;
	method: string;
	contentType: string | null;
	body: Json;
}

export interface FakeDevice {
	deviceId: string;
	online: boolean;
	createdAt: string;
	lastSeenAt: string | null;
}

export interface FakeHost {
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
