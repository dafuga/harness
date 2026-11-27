export type PrivateBrowserPhase = 'blocked' | 'ready' | 'draining' | 'private' | 'disposing';

export interface PrivateBrowserCleanup {
	/** Close and drain all viewer and secret-delivery operations before returning. */
	revokeInput(): Promise<void>;
	/** Confirm all private form tabs are gone, including any restored after an executor restart. */
	disposeForm(): Promise<void>;
	/** Check the reviewed result in a separate safe page. No browser data leaves the executor. */
	verifyResult(): Promise<boolean>;
}

export interface PrivateBrowserRequest {
	requestId: string;
	deviceId: string;
	expiresAt: number;
	expiry: ReturnType<typeof setTimeout>;
	drained: Promise<unknown>;
}
