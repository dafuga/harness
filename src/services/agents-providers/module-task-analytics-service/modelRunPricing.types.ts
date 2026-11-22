// @harness-uid u_yatjr7fj3t
import type { TaskUsage } from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export interface StandardRates {
	source: string;
	threshold: number;
	short: number[];
	long: number[];
}
export type PricedUsage = TaskUsage & { inputTokens: number; outputTokens: number };
