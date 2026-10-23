export interface GoogleIdentity {
	initialize(options: {
		client_id: string;
		nonce: string;
		callback: (response: { credential: string }) => void;
		ux_mode: 'popup';
	}): void;
	renderButton(element: HTMLElement, options: Record<string, string>): void;
}
