// @harness-uid u_4oijppigay
export class UnsupportedAnalyticsSchemaVersionError extends Error {
	constructor() {
		super('Unsupported analytics schema version.');
		this.name = 'UnsupportedAnalyticsSchemaVersionError';
	}
}
