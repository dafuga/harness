import type { BehaviorFact, BehaviorFactOptions, BehaviorScenario } from './behaviorFacts.types';
/** @pure Format duration and scenario outcomes without consulting an input array's iterator or species. */
export function behaviorFacts(
	duration: string | null,
	scenarios: BehaviorScenario[],
	paired: boolean,
	options: BehaviorFactOptions = {}
): BehaviorFact[] {
	const rows: BehaviorFact[] = [
		{
			key: 'duration',
			label: options.durationLabel ?? 'E2E duration',
			value: duration ?? 'Not measured',
			className: options.highlight && duration === 'Not measured' ? 'unmeasured' : ''
		}
	];
	for (let index = 0; index < scenarios.length; index++) {
		rows.push(scenarioFact(scenarios[index], paired, options.highlight ?? false));
	}
	return rows;
}

/** @pure One scenario keeps its own label, outcomes and highlighting. */
function scenarioFact(
	scenario: BehaviorScenario,
	paired: boolean,
	highlight: boolean
): BehaviorFact {
	const key = scenario.id;
	const label = scenario.title;
	const className = highlight && scenario.after !== 'passed' ? 'failed' : '';
	const prefix = paired ? `${scenario.before ?? 'not run'} → ` : '';
	return { key, label, className, value: prefix + (scenario.after ?? 'not run') };
}
