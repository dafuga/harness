// @harness-uid u_m5tmgubvzt
import type { z } from 'zod';
import type {
	projectModuleMilestones,
	projectModulePlanSchema,
	projectModuleSchema
} from './projectModuleProgress';

export type ProjectModule = z.infer<typeof projectModuleSchema>;
export type ProjectModulePlan = z.infer<typeof projectModulePlanSchema>;
export type ProjectModuleMilestone = (typeof projectModuleMilestones)[number]['id'];
