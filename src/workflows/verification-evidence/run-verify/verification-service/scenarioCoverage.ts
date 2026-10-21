import type {
	CoverageInput,
	CoverageResult
} from '../../../../utils/verification-evidence/scenarioCoverage';
import { problem } from '../../../../utils/verification-evidence/scenarioCoverage';
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';
import { scenarioRequirements } from '../../../../utils/verification-evidence/scenarioRequirements';

/** Judges gathered captures against the scenario contract: completeness, validity, freshness. */
export function scenarioCoverage(input: CoverageInput): CoverageResult {
	const { scenario, gathered } = input;
	const requirements = scenarioRequirements(scenario);
	const problems = new Map(gathered.map((item) => [item, problem(input, item)]));
	const absent = requirements.required
		.filter((need) => !gathered.some((item) => matches(item, need)))
		.map((need) => {
			const where = need.viewport ? ` at viewport ${need.viewport}` : '';
			return `missing ${need.kind} for state ${need.state}${where}`;
		});
	const failures = [
		...requirements.unproven.map(
			(item) => `state ${item.state} is declared missing: ${item.reason}`
		),
		...absent,
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
	return { states, failures: failures.map((failure) => `${scenario.id}: ${failure}`) };
}

function matches(
	item: Gathered,
	need: { evidence: string; state: string; viewport?: string }
): boolean {
	const { line } = item;
	return (
		line.evidence === need.evidence && line.state === need.state && line.viewport === need.viewport
	);
}
