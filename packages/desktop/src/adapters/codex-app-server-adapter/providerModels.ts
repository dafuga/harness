import type { ModelChoice } from '../../models/Desktop.types';

interface CodexModel {
	model: string;
	displayName: string;
	hidden: boolean;
	supportedReasoningEfforts: { reasoningEffort: string }[];
	defaultReasoningEffort: string;
	isDefault: boolean;
}

export function providerModels(models: CodexModel[]): ModelChoice[] {
	return models
		.filter((m) => !m.hidden)
		.map((m) => ({
			id: m.model,
			label: m.displayName,
			efforts: m.supportedReasoningEfforts.map((e) => e.reasoningEffort),
			defaultEffort: m.defaultReasoningEffort,
			isDefault: m.isDefault
		}));
}
