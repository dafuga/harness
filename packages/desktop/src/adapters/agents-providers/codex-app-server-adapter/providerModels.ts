import type { CodexModel } from './providerModels.types';
import type { ModelChoice } from '../../../models/development-tooling/Desktop.types';

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
