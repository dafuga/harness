// @harness-uid u_ob4stlw5fp
export class BrowserApiRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BrowserApiRequestError';
	}
}
