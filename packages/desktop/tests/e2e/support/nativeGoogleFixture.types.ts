export type Start = { challenge: string; nonce: string; resource: string; callback: number };
export type Exchange = {
	handoffId: string;
	verifier: string;
	nonce: string;
	resource: string;
	callbackCode: string;
};
export type Status = { configured: boolean; state: string };
