// @harness-uid u_rmurdehorf
import { createHash } from 'node:crypto';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskFeature
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { difficultyForFiles } from '../module-task-analytics-service/modelRunRecord';
export function queuedTask(
	input: ModuleTaskInput,
	feature: TaskFeature,
	unit: ComponentManifest,
	sourceCommit: string
): ModuleTask {
	const files = [...new Set([...unit.owns.source, ...(input.verificationFiles ?? [])])];
	return {
		...input,
		estimatedDifficulty: input.estimatedDifficulty ?? difficultyForFiles(files.length),
		feature,
		module: {
			id: unit.id,
			goal: input.moduleGoal ?? unit.responsibility,
			files
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
