// @harness-uid u_352ajnp2sk
export class InvalidHostedProjectError extends Error {
	constructor() {
		super('Invalid hosted project.');
		this.name = 'InvalidHostedProjectError';
	}
}
