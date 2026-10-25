import { createHash } from 'node:crypto';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskFeature
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
export function queuedTask(
	input: ModuleTaskInput,
	feature: TaskFeature,
	unit: ComponentManifest,
	sourceCommit: string
): ModuleTask {
	return {
		...input,
		feature,
		module: {
			id: unit.id,
			goal: input.moduleGoal ?? unit.responsibility,
			files: [...new Set([...unit.owns.source, ...(input.verificationFiles ?? [])])]
		},
		sourceCommit,
		contractHash: createHash('sha256').update(stableJson(input.wantedContract)).digest('hex'),
		status: 'queued',
		createdAt: new Date().toISOString(),
		attempts: [],
		reviews: [],
		claimHistory: []
	};
}
