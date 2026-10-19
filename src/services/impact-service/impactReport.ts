import { graphTests, testFile } from '../../utils/impactReport';
import type { ImpactReport, ImpactSide } from '../../core/impactTypes';
import type { AffectedNode, ImpactOutput } from '../../core/kernelTypes';
import type { UncertainNode } from '../../core/sourceTypes';
import type { ImpactSeeds } from '../../utils/impactSeeds';

const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].sort();

function ids(affected: AffectedNode[], prefix: string, keep: (node: AffectedNode) => boolean) {
	return affected
		.filter((node) => node.id.startsWith(prefix) && keep(node))
		.map((node) => node.id.slice(prefix.length));
}

interface Assembly {
	sides: { base: ImpactSide; head: ImpactSide };
	seeds: ImpactSeeds;
	output: ImpactOutput;
}

/** Everything that widened selection: unbounded changes, uncovered files, uncertain aliases. */
function uncertainty(input: Assembly): { all: UncertainNode[]; expanded: boolean } {
	const source = new Set(
		input.seeds.changed
			.filter((change) => change.classification === 'source')
			.map((change) => `file:${change.path}`)
	);
	const uncovered: UncertainNode[] = input.output.uncovered
		.filter((id) => source.has(id))
		.map((node) => ({
			node,
			reason: 'uncovered-change',
			detail: 'no test or scenario depends on this file'
		}));
	const seeded = new Set(ids(input.output.affected, '', (node) => node.seed === 'uncertain'));
	const aliases = [...input.sides.base.graph.uncertain, ...input.sides.head.graph.uncertain].filter(
		(entry) => seeded.has(entry.node)
	);
	const unbounded = [...input.seeds.expansions, ...uncovered];
	const keyed = new Map(
		[...unbounded, ...aliases].map((entry) => [
			`${entry.node}\n${entry.reason}\n${entry.detail}`,
			entry
		])
	);
	const all = [...keyed.keys()].sort().map((key) => keyed.get(key) as UncertainNode);
	return { all, expanded: unbounded.length > 0 };
}

/** Shapes the kernel answer into units, tests and scenarios, widening it when uncertain. */
export function impactReport(input: Assembly): Omit<ImpactReport, 'base' | 'head' | 'runtime'> {
	const { head } = input.sides;
	const { affected } = input.output;
	const { all, expanded } = uncertainty(input);
	const everyTest = graphTests(head.graph);
	const everyScenario = head.scenarios.map((scenario) => scenario.id);
	const scenarios = expanded
		? everyScenario
		: ids(affected, 'scenario:', (node) => node.presence !== 'removed');
	const scenarioTests = head.scenarios
		.filter((scenario) => scenarios.includes(scenario.id))
		.flatMap((scenario) =>
			scenario.tests.map((test) => [test.cwd, test.target].filter(Boolean).join('/'))
		);
	const reached = ids(affected, 'file:', (node) => node.presence !== 'removed');
	const selected = expanded
		? everyTest
		: [...reached, ...scenarioTests].filter((path) => everyTest.includes(path));
	const units = ids(affected, 'unit:', () => true);
	const everyUnit = expanded ? head.graph.nodes.filter((node) => node.kind === 'unit') : [];
	const reachedUnits = [...units, ...everyUnit.map((node) => node.id.slice('unit:'.length))];
	return {
		expanded,
		changed: input.seeds.changed,
		units: {
			direct: sortedUnique(reachedUnits.filter((unit) => input.seeds.direct.has(unit))),
			indirect: sortedUnique(reachedUnits.filter((unit) => !input.seeds.direct.has(unit))),
			added: sortedUnique(ids(affected, 'unit:', (node) => node.presence === 'added')),
			removed: sortedUnique(ids(affected, 'unit:', (node) => node.presence === 'removed'))
		},
		tests: {
			selected: sortedUnique(selected),
			excluded: everyTest.filter((path) => !selected.includes(path)).sort(),
			removed: sortedUnique(
				ids(affected, 'file:', (node) => node.presence === 'removed' && testFile.test(node.id))
			)
		},
		scenarios: {
			affected: sortedUnique(scenarios),
			unaffected: everyScenario.filter((id) => !scenarios.includes(id)).sort()
		},
		uncertain: all
	};
}
