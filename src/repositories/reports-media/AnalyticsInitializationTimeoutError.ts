// @harness-uid u_4oijppigay
export class AnalyticsInitializationTimeoutError extends Error {
	constructor() {
		super('Timed out waiting to initialize the analytics database.');
		this.name = 'AnalyticsInitializationTimeoutError';
	}
}
