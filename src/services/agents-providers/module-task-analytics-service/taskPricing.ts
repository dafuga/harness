// @harness-uid u_27nvefwsgd
import type {
	TaskUsage,
	TaskApiCost
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { estimateApiCost } from './model-analytics.mjs';

/** Quote standard global API-equivalent costs from the shared model rate card. */
export function taskApiCost(model: string, usage?: TaskUsage): TaskApiCost {
	return estimateApiCost(model, usage);
}
