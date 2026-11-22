// @harness-uid u_riakl65jnq
export interface ProviderSelection {
	provider: 'openai' | 'harness-claude';
	model: string;
	effort: string;
}

export interface PickerModel {
	provider: ProviderSelection['provider'];
	model: string;
	label: string;
	efforts: string[];
	defaultEffort: string;
	source: 'local-catalog';
}

/** An explicit Codex session ID that does not match the session-ID pattern. */
export class InvalidSessionIdError extends Error {
	override name = 'InvalidSessionIdError';
}
