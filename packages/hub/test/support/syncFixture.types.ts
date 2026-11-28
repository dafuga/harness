import type { SyncSocket } from './syncSocket';

/** What a call adds: a body, sent as text when it is a string, and extra headers. */
export interface CallExtra {
	body?: unknown;
	headers?: Record<string, string>;
}

/** Another Hub worker entry, and the migrations it needs beside the sealed sync one. */
export interface SyncStart {
	entry?: string;
	migrations?: string[];
	country?: string;
}

export interface SyncFixture {
	origin: string;
	db: D1Database;
	bucket: R2Bucket;
	/** Every request line, header value and body, and every socket message, sent or received. */
	sent: (string | Uint8Array)[];
	/** A request to `/api/sync/v1/<path>` as a test session; a string body is sent as it is. */
	call(session: string | null, method: string, path: string, extra?: CallExtra): Promise<Response>;
	socket(session: string, device: string): Promise<SyncSocket>;
	/** What the account object keeps in its own storage, as stored. */
	objectRows(account: string): Promise<unknown[]>;
	stop(): Promise<void>;
}
