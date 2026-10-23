import type { pairing, phone } from './ui-remote-host-fixture';

export type Listener = (status: unknown) => void;

export type Grant = { deviceId: string; projectIds: string[]; agents: boolean };

export interface HostOptions {
	enabled: boolean;
	origin: string;
	/** How long each synthetic offer claims to live. */
	ttlMs: number;
	later: string[];
	pairing: typeof pairing;
	phone: typeof phone;
	projects: { id: string; name: string }[];
}

export type Change = Record<string, unknown>;

export interface HostState {
	status: { devices: Record<string, unknown>[] };
	listeners: Set<Listener>;
	copy: () => unknown;
	done: (op: string, input: object, change: Change) => Promise<unknown>;
	request: () => void;
}

export interface RemoteHost {
	harnessRemote: Record<string, unknown>;
	__calls: Record<string, unknown>[];
	__remoteHost: HostState;
}
