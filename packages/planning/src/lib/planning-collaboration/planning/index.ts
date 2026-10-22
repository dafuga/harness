import type {
	PlanningApi,
	PlanningRequest,
	PlanningResult
} from '../../../models/planning-collaboration/PlanningBridge.types';
import type { PlanningErrorCode } from '../../../models/planning-collaboration/PlanningView.types';
import { planGit } from './planGit';
import { planningService } from './planning-service/PlanningService';

export type * from '../../../models/planning-collaboration/Planning.types';

export type * from '../../../models/planning-collaboration/PlanningBridge.types';

export type * from '../../../models/planning-collaboration/PlanningView.types';

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

export { planImageCodec } from '../../../utils/planning-collaboration/planImageCodec';

export { planCommit } from '../../../utils/planning-collaboration/plan-write/planCommit';

export { planIdentity } from '../../../utils/planning-collaboration/planIdentity';

export { planOptions } from './planning-service/planOptions';

export { planReads } from './planning-service/planReads';
