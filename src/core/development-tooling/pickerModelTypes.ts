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

export function sameSelection(a: ProviderSelection, b: ProviderSelection): boolean {
	return a.provider === b.provider && a.model === b.model && a.effort === b.effort;
}

export function validateSessionId(value: string): string {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value))
		throw new Error('A valid explicit Codex session ID is required.');
	return value;
}
