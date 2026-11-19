// @harness-uid u_27nvefwsgd
import type { TaskUsage } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { estimateApiCost } from './modelRunPricing';

/** Quote token-equivalent standard API costs with the Tracker rate card. */
export function taskApiCost(model: string, usage?: TaskUsage) {
	return estimateApiCost(model, usage);
}
