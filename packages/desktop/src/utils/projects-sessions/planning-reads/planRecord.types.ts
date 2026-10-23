import type { PlanningApi } from '../../../../../planning/src/lib/planning/index';

export interface PlanningContext {
	root: string;
	api: PlanningApi;
}
