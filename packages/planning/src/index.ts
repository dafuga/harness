import type { PlanningApi, PlanningRequest, PlanningResult } from './models/PlanningBridge.types';
import type { PlanningErrorCode } from './models/PlanningView.types';
import { planGit } from './utils/planGit';
import { planningService } from "./services/planning-service/PlanningService";
export type * from './models/Planning.types.ts';
export type * from './models/PlanningBridge.types.ts';
export type * from './models/PlanningView.types.ts';
export async function createPlanning(root: string): Promise<PlanningApi> {
	return planningService(await planGit(root));
}
export default createPlanning;
export async function handlePlanningRequest(
	api: PlanningApi,
	request: PlanningRequest
): Promise<PlanningResult<unknown>> {
	try {
		if (!request || !Object.hasOwn(api, request.operation))
			throw Object.assign(new Error('Unknown planning operation'), { code: 'invalid-input' });
		const operation = api[request.operation] as (input: unknown) => Promise<unknown>;
		return { ok: true, value: await operation(request.input) };
	} catch (error) {
		const failure = error as { code?: PlanningErrorCode; message?: string };
		return {
			ok: false,
			error: {
				code: failure.code ?? 'invalid-input',
				message: failure.message ?? 'Planning request failed',
				path: null
			}
		};
	}
}
export { planImageCodec } from './utils/planImageCodec';
export { planCommit } from './utils/plan-write/planCommit';
export { planIdentity } from './utils/planIdentity';
export { planOptions } from './services/planning-service/planOptions';
export { planReads } from './services/planning-service/planReads';
