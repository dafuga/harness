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
