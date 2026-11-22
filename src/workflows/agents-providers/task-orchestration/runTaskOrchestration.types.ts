// @harness-uid u_wgjqmurp64
import type {
	TaskPlatform,
	TaskSelection,
	TaskSessionMetric
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export interface OrchestrationReport extends TaskSelection {
	id: string;
	tracker: string;
	platform?: TaskPlatform;
	status: 'running' | 'succeeded' | 'failed' | 'interrupted';
	file: string;
	contextTokens: number;
	checkpoint: string;
	sessions: TaskSessionMetric[];
	error?: string;
}
