import type {
	FeaturePlan,
	ModuleTask,
	TaskFeature
} from '../../repositories/agents-providers/ModuleTaskRepository.types';

export interface FeatureWorkTask {
	id: string;
	title: string;
	module: string;
	status: ModuleTask['status'];
	dependsOn: string[];
	blockedBy: string[];
	belongsToPlan: boolean;
}

export interface FeatureWorkSnapshot {
	queueCommit: string | null;
	features: (TaskFeature & { plan: FeaturePlan | null; tasks: FeatureWorkTask[] })[];
}
