export interface StoredRow {
	key: string;
	value: string;
}

/** How a management call differs from `POST /manage/<operation>` on the object of `body.hostId`. */
export interface BindingCall {
	object?: string;
	method?: string;
	path?: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type Binding =
	| { type: 'text'; value: string }
	| { type: 'durable-object'; worker: string; exportName: string };

/** One more Worker beside the relay, for a caller that tests its own code against the relay. */
export interface ExtraWorker {
	name: string;
	script: string;
	env?: Record<string, Binding>;
	/** Durable Object classes this Worker itself exports. */
	objects?: string[];
}

export interface RelayOptions {
	/** A fixed port on 127.0.0.1 for the public Worker; any free one when omitted. */
	port?: number;
	workers?: ExtraWorker[];
}

export interface RelayFixture {
	/** `http://127.0.0.1:<port>` of the public Worker. */
	origin: string;
	socketOrigin: string;
	/** A request to the public Worker. */
	fetch(path: string, init?: RequestInit): Promise<Response>;
	/** `POST` of a JSON body to the public Worker. */
	post(path: string, body: unknown): Promise<Response>;
	/** A call through the namespace binding of the hub stand-in. */
	manage(operation: string, body: Record<string, unknown>, call?: BindingCall): Promise<Response>;
	/** A request to a relay configured as production, with the URL the Worker will see. */
	strict(url: string, init?: RequestInit): Promise<Response>;
	/** What the object of a host keeps, as stored. Empty when it never stored anything. */
	rows(hostId: string): Promise<StoredRow[]>;
	/** An extra Worker, called directly as a platform would call it. */
	worker(name: string): Promise<{ fetch: Fetcher }>;
	stop(): Promise<void>;
}
