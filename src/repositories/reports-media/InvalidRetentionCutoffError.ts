// @harness-uid u_4oijppigay
export class InvalidRetentionCutoffError extends Error {
	constructor() {
		super('Retention cutoff must be an ISO UTC timestamp in the past.');
		this.name = 'InvalidRetentionCutoffError';
	}
}
