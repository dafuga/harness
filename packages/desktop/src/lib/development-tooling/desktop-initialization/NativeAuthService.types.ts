// @harness-uid u_bt6e76o6y5
import type { HostedHttpAdapter } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../../adapters/networking-security/NativeSessionAdapter';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';

export interface AuthOptions {
	origin: string;
	http: HostedHttpAdapter;
	store: NativeSessionAdapter;
	open: (url: string) => Promise<void>;
	now?: () => number;
	clearCache?: () => Promise<void>;
	onDisconnect?: () => void;
}

export interface Pending {
	handoffId: string;
	verifier: string;
	nonce: string;
	resource: string;
	next: number;
	status: NativeHostedStatus;
}

/** A native sign-in that cannot start without OS encryption, or whose handoff was not approved. */
export class NativeSignInError extends Error {
	override name = 'NativeSignInError';
}
