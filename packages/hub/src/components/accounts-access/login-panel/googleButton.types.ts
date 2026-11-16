// @harness-uid u_b5quvbjmrl
export interface GoogleIdentity {
	initialize(options: {
		client_id: string;
		nonce: string;
		callback: (response: { credential: string }) => void;
		ux_mode: 'popup';
	}): void;
	renderButton(element: HTMLElement, options: Record<string, string>): void;
}
/** Google sign-in's script failed to load, or loaded without its identity object. */
export class GoogleSignInLoadError extends Error {
	override name = 'GoogleSignInLoadError';
}
