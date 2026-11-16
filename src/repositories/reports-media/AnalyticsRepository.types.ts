// @harness-uid u_4oijppigay
/* eslint-disable max-classes-per-file -- One distinct error class per failure. */
export class UnsupportedAnalyticsSchemaVersionError extends Error {
	constructor() {
		super('Unsupported analytics schema version.');
		this.name = 'UnsupportedAnalyticsSchemaVersionError';
	}
}

export class InvalidRetentionCutoffError extends Error {
	constructor() {
		super('Retention cutoff must be an ISO UTC timestamp in the past.');
		this.name = 'InvalidRetentionCutoffError';
	}
}

export class AnalyticsInitializationTimeoutError extends Error {
	constructor() {
		super('Timed out waiting to initialize the analytics database.');
		this.name = 'AnalyticsInitializationTimeoutError';
	}
}
