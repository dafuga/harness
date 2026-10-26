import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { mockContexts } from './module-task-worker.test.fixtures';

export function quotedWorker(root: string, inputTokens: string | number | null) {
	return new ModuleTaskWorkerService(
		root,
		{
			run: async (input) => ({
				provider: input.provider,
				model: input.model,
				intelligence: input.intelligence,
				text: 'Done',
				reportedModel: input.model,
				usage: {
					inputTokens: Number(inputTokens),
					outputTokens: 20,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cacheWriteLongTokens: 0,
					reportedCostUsd: null
				}
			})
		},
		mockContexts().contexts
	);
}
