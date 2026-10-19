

/** Google's own script, from its fixed address. No other identity script is ever loaded. */
export const googleIdentityScript = 'https://accounts.google.com/gsi/client';

export interface GoogleButton {
	clientId: string;
	/** Of a fresh challenge: the server accepts the credential only with this nonce inside. */
	nonce: string;
	credential: (value: string) => void;
}

export { googleButton } from '../components/login-panel/googleButton';
