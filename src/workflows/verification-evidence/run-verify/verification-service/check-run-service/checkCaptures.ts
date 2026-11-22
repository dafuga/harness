// @harness-uid u_3flwsx2557
import { join } from 'node:path';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';
import type { RunContext } from './CheckRunService.types';
import type { RecordBudget } from './captureLimits';
import type { GatherResult } from '../../../../../utils/verification-evidence/gatherCaptures';
import { gatherVerificationCaptures } from './gatherVideoReferences';
import { checkVideoContext } from './checkVideoContext';

export async function checkCaptures(
	context: RunContext,
	check: PlannedCheck,
	budget: RecordBudget,
	result: { timedOut: boolean; evidencePath: string }
): Promise<GatherResult> {
	if (result.timedOut) return { gathered: [], failures: [] };
	const captures = await gatherVerificationCaptures(
		join(context.directory, result.evidencePath),
		result.evidencePath,
		context.limits,
		{ budget, root: context.directory, video: checkVideoContext(context, check) }
	);
	if (!context.lite) return captures;
	const gathered = captures.gathered.filter(
		({ line }) => line.kind !== 'screenshot' && line.kind !== 'video'
	);
	if (gathered.length === captures.gathered.length) return captures;
	return {
		gathered,
		failures: [...captures.failures, 'captured screenshots in Lite; declare it fullOnly.']
	};
}
