// @harness-uid u_3flwsx2557
import { join } from 'node:path';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';
import type { RunContext } from './CheckRunService.types';
import type { RecordBudget } from './captureLimits';
import type { GatherResult } from '../../../../../utils/verification-evidence/gatherCaptures';
import { gatherVerificationCaptures } from './gatherVideoReferences';
import { checkVideoContext } from './checkVideoContext';

export function checkCaptures(
	context: RunContext,
	check: PlannedCheck,
	budget: RecordBudget,
	result: { timedOut: boolean; evidencePath: string }
): Promise<GatherResult> {
	return result.timedOut
		? Promise.resolve({ gathered: [], failures: [] })
		: gatherVerificationCaptures(
				join(context.directory, result.evidencePath),
				result.evidencePath,
				context.limits,
				{ budget, root: context.directory, video: checkVideoContext(context, check) }
			);
}
