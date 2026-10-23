import type { GoogleIdentity } from './googleButton.types';
import type { GoogleButton } from '../../../utils/accounts-access/googleButton';
import { googleIdentityScript } from '../../../utils/accounts-access/googleButton';

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
