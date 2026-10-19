/** Google's own script, from its fixed address. No other identity script is ever loaded. */
export const googleIdentityScript = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
	initialize(options: {
		client_id: string;
		nonce: string;
		callback: (response: { credential: string }) => void;
		ux_mode: 'popup';
	}): void;
	renderButton(element: HTMLElement, options: Record<string, string>): void;
}
export interface GoogleButton {
	clientId: string;
	/** Of a fresh challenge: the server accepts the credential only with this nonce inside. */
	nonce: string;
	credential: (value: string) => void;
}

let loading: Promise<GoogleIdentity> | null = null;
const loaded = () =>
	(globalThis as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts
		?.id;

function load(): Promise<GoogleIdentity> {
	loading ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = googleIdentityScript;
		script.async = true;
		script.onload = () => {
			const identity = loaded();
			if (identity) resolve(identity);
			else reject(new Error('Google sign-in did not load.'));
		};
		script.onerror = () => {
			loading = null;
			reject(new Error('Google sign-in could not be loaded.'));
		};
		document.head.appendChild(script);
	});
	return loading;
}

/** Renders Google's button. The credential it yields is handed on and kept nowhere. */
export async function googleButton(element: HTMLElement, options: GoogleButton): Promise<void> {
	const identity = await load();
	identity.initialize({
		client_id: options.clientId,
		nonce: options.nonce,
		callback: (response) => options.credential(response.credential),
		ux_mode: 'popup'
	});
	identity.renderButton(element, { theme: 'filled_black', size: 'large', text: 'signin_with' });
}
