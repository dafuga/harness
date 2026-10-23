import type { ada } from './hosted-data';
import type { HostedData } from './hosted-data';

export interface HostedCall {
	method: string;
	path: string;
	query: Record<string, string>;
	body: Record<string, unknown> | null;
}

export interface HostedState {
	configured: boolean;
	signedIn: boolean;
	actor: typeof ada;
	empty: boolean;
	github: { configured: boolean; connected: boolean; login: string | null };
	/** An address that waits for its code, and whether this deployment can send email. */
	email: {
		proof: { email: string; sent: boolean; expiresAt: string | null } | null;
		delivery: boolean;
	};
	/** A desktop app that waits for approval, as the server would describe it. */
	native: { status: string; resource: string | null };
	data: HostedData;
	calls: HostedCall[];
	/** Requests that left the page for Google's own script. */
	google: string[];
}

export type Answer = { status?: number; json?: unknown; bytes?: Uint8Array };
