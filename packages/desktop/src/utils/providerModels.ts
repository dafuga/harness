import type { ModelChoice } from '../models/Desktop.types';
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
export function validateModel(models: ModelChoice[], model: string, effort: string | null): void {
	const selected = models.find((m) => m.id === model);
	if (!selected) throw new Error('The selected model is not available from this CLI.');
	if (effort && !selected.efforts.includes(effort))
		throw new Error('The selected model does not support this effort.');
}
