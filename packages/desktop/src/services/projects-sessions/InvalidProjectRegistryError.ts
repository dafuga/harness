// @harness-uid u_dye5qghokk
export class InvalidProjectRegistryError extends Error {
	constructor() {
		super('Invalid project registry.');
		this.name = 'InvalidProjectRegistryError';
	}
}
