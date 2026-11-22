// @harness-uid u_dye5qghokk
export class UnknownProjectError extends Error {
	constructor() {
		super('Unknown project.');
		this.name = 'UnknownProjectError';
	}
}
