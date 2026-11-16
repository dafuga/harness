// @harness-uid u_dye5qghokk
export class InvalidProjectRegistryError extends Error {
	constructor() {
		super('Invalid project registry.');
		this.name = 'InvalidProjectRegistryError';
	}
}

export class UnknownProjectError extends Error {
	constructor() {
		super('Unknown project.');
		this.name = 'UnknownProjectError';
	}
}
