// @harness-uid u_lnqhwcablp
import type {
	CoverageInput,
	CoverageResult,
	ScenarioJudgement
} from '../../../../utils/verification-evidence/scenarioCoverage.types';
import { problem } from './captureProblem';
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';
import { scenarioRequirements } from '../../../../utils/verification-evidence/scenarioRequirements';
import { videoCoverageReport } from './videoCoverage';
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import type { Executed } from './SnapshotRunService';
import type { VerifyContext } from './VerificationService.types';
import { scopeFailure } from './entityScope';
import { verificationScenarioCoverage } from './verificationScenarioCoverage';

/** Judges gathered captures against the scenario contract: completeness, validity, freshness. */
export function scenarioCoverage(input: CoverageInput): CoverageResult {
	const { scenario, gathered } = input;
	const requirements = scenarioRequirements(scenario);
	const problems = new Map(gathered.map((item) => [item, problem(input, item)]));
	const missing = requirements.required.filter(
		(need) =>
			(Boolean(input.lite) && isVisual(need.kind)) || !gathered.some((item) => matches(item, need))
	);
	const pending = input.lite
		? missing.filter((need) => input.lite?.deferredChecks === true || isVisual(need.kind))
		: [];
	const absent = missing
		.filter((need) => !pending.includes(need))
		.map((need) => {
			const where = need.viewport ? ` at viewport ${need.viewport}` : '';
			return `missing ${need.kind} for state ${need.state}${where}`;
		});
	const video = input.lite
		? { failures: [], graphs: [] }
		: videoCoverageReport(
				input,
				gathered.filter((item) => problems.get(item) === undefined)
			);
	const failures = [
		...requirements.unproven.map(
			(item) => `state ${item.state} is declared missing: ${item.reason}`
		),
		...absent,
		...video.failures,
		...[...problems.values()].flatMap((found) => found ?? [])
	];
	const failed = (item: Gathered) => input.checkFailed || problems.get(item) !== undefined;
	const states = scenario.states.map((state) => ({
		id: state.id,
		coverage: state.coverage,
		...(state.reason ? { reason: state.reason } : {}),
		captures: gathered
			.filter((item) => item.line.state === state.id)
			.map((item) => ({
				...item.capture,
				status: failed(item) ? ('failed' as const) : ('passed' as const)
			}))
	}));
	return {
		states,
		failures: failures.map((failure) => `${scenario.id}: ${failure}`),
		...(scenario.video && !input.lite ? { videoCoverage: video.graphs } : {}),
		...(pending.length > 0 ? { pending } : {})
	};
}

function matches(
	item: Gathered,
	need: { evidence: string; kind: string; state: string; viewport?: string }
): boolean {
	const { line } = item;
	return (
		line.kind === need.kind &&
		line.evidence === need.evidence &&
		line.state === need.state &&
		line.viewport === need.viewport
	);
}

/** Completeness and outcome for the checks this profile selected for one scenario. */
export function judgeScenario(
	context: VerifyContext,
	scenario: ScenarioManifest,
	executed: Executed,
	pendingChecks: PlannedCheck[]
): ScenarioJudgement {
	const lite = context.verificationProfile === 'lite';
	const deferred = pendingChecks.filter((check) => check.scenario === scenario.id).length;
	const { own, coverage } = verificationScenarioCoverage(context, scenario, executed, deferred);
	const ran = own.length === scenario.tests.length - deferred;
	const failures = [
		...own.flatMap((outcome) => outcome.failures),
		...coverage.failures,
		...(ran ? [] : [`${scenario.id}: its checks did not run`])
	];
	const pending = (coverage.pending ?? []).map(({ kind: _kind, ...slot }) => ({
		...slot,
		scenario: scenario.id
	}));
	const result: ScenarioResult = {
		id: scenario.id,
		status: scenarioStatus(failures, deferred > 0 || pending.length > 0),
		testedRevision: context.commit,
		states: coverage.states,
		...(coverage.videoCoverage ? { videoCoverage: coverage.videoCoverage } : {})
	};
	if (context.entity && !lite) failures.push(scopeFailure(context.entity));
	return { result, failures, pending };
}

function scenarioStatus(failures: string[], pending: boolean): ScenarioResult['status'] {
	if (failures.length > 0) return 'failed';
	return pending ? 'pending' : 'passed';
}

function isVisual(kind: string): boolean {
	return kind === 'screenshot' || kind === 'video';
}
