export type Operation = (input?: unknown) => Promise<unknown>;

export type Callback = (value: unknown) => void;

export type Call = { method: string; input: { projectId?: string } };

export interface PhoneOptions {
	state: string;
	origin: string;
	host: { id: string; name: string };
	device: { id: string; name: string };
	seenAt: string;
	granted: { id: string; name: string }[];
}

export interface PhoneState {
	options: PhoneOptions;
	phone: { state: string; deviceName: string | null };
	/** How the next scans end: a failure code of the plugin each, then success. */
	scans: string[];
	computer: Record<string, Operation>;
	listeners: Map<string, { eventName: string; callback: Callback }>;
	status: () => Record<string, unknown>;
	set: (state: string) => void;
	request: (call: Call) => Promise<unknown>;
}

export interface PhoneHost {
	harness?: Record<string, Operation>;
	__calls: Record<string, unknown>[];
	__projects: { selected: string | null };
	__remotePhone: PhoneState;
}

export type Listen = { eventName: string; callbackId?: string };
