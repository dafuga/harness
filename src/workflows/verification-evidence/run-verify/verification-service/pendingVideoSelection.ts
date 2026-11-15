// @harness-uid u_k23ebybqw2
import type { PendingVideoSelection } from './pendingVideoSelection.types';
import type { VerifyContext } from './VerificationService.types';
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';
import { snapshotVideoFlags } from './snapshotVideoFlags';
import { scopedCheck, scopedScenarios } from './entityScope';
import { verifyPlan } from './verifyPlan';

/** Await this for current reviewer standing; plan() itself remains declaration-only and sync. */
export async function pendingVideoScenarioIds(
	root: string,
	scenarios: ScenarioManifest[]
): Promise<Set<string>> {
	const flags = await snapshotVideoFlags(root, scenarios);
	return new Set(
		Object.entries(flags)
			.filter(([, requirements]) => requirements.pending.length > 0)
			.map(([id]) => id)
	);
}
export function pendingVideoSelection(
	context: VerifyContext,
	previous: ScenarioResult[],
	pending: ReadonlySet<string> = new Set()
): PendingVideoSelection {
	const { entity } = context;
	const referenced = entity ? [] : previous.filter((scenario) => !pending.has(scenario.id));
	const kept = new Set(referenced.map((scenario) => scenario.id));
	const rerun = entity
		? scopedScenarios(context.head.scenarios, entity)
		: context.head.scenarios.filter((scenario) => !kept.has(scenario.id));
	const planned = verifyPlan({
		selectedTests: entity ? [] : context.impact.tests.selected,
		scenarios: rerun,
		config: context.config,
		unitsConfig: context.head.config,
		testTimeoutMs: context.testTimeoutMs
	});
	return {
		plan: entity ? planned.map((check) => scopedCheck(check, entity)) : planned,
		referenced,
		rerun
	};
}
