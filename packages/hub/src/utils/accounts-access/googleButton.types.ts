export interface GoogleButton {
	clientId: string;
	/** Of a fresh challenge: the server accepts the credential only with this nonce inside. */
	nonce: string;
	credential: (value: string) => void;
}
