import type { RevisionRegistry } from './revisionRegistry.types';
import { createHash } from 'node:crypto';
import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import type { BudgetBaseline } from '../budgetFindings';
import { emittedLimits, frozenLimits } from './frozenLimits';
import {} from '../budgetReviews';
import { canonicalJson } from '../../development-tooling/canonicalJson';

const byId = <Item extends { id: string }>(left: Item, right: Item) =>
	left.id < right.id ? -1 : 1;

/**
 * The registry of one revision as it is stored there: its units, its scenarios and the unit
 * graph they declare. This is the recorded graph of that revision, not a recomputed one.
 */
export function revisionRegistry(
	manifests: ComponentManifest[],
	scenarios: ScenarioManifest[],
	blobs: Map<string, string> = new Map(),
	baselines: Map<string, BudgetBaseline> = new Map()
): RevisionRegistry {
	const units = [...manifests].sort(byId).map((unit) => {
		const emitted = emittedLimits(unit, baselines.get(unit.id));
		const limits = frozenLimits(baselines.get(unit.id));
		return {
			...unitView(unit, blobs),
			...(emitted ? { emitted } : {}),
			...(limits ? { limits } : {})
		};
	});
	const listed = [...scenarios].sort(byId).map(scenarioView);
	const depends = units.flatMap((unit) =>
		unit.dependencies.map(({ unit: target, via }) => ({
			from: `unit:${unit.id}`,
			to: `unit:${target}`,
			via
		}))
	);
	const covers = listed.flatMap((scenario) =>
		scenario.units.map((unit) => ({
			from: `scenario:${scenario.id}`,
			to: `unit:${unit}`,
			via: 'covers'
		}))
	);
	const nodes = [
		...units.map((unit) => ({ id: `unit:${unit.id}`, kind: 'unit' as const })),
		...listed.map((scenario) => ({ id: `scenario:${scenario.id}`, kind: 'scenario' as const }))
	];
	const available = units.length > 0;
	const gap = available ? {} : { gap: 'no unit registry is stored at this revision' };
	return {
		available,
		...gap,
		units,
		scenarios: listed,
		graph: { nodes, edges: [...depends, ...covers] }
	};
}

function unitView(
	unit: ComponentManifest,
	blobs: Map<string, string>
): RevisionRegistry['units'][number] {
	const { inputs, outputs, errors } = unit.contract;
	const paths = [...unit.owns.source, ...(unit.documentation ? [unit.documentation] : [])];
	const files = paths.map((path) => `${path}:${blobs.get(path) ?? 'absent'}`);
	return {
		id: unit.id,
		kind: unit.kind,
		...(unit.composition ? { composition: unit.composition } : {}),
		status: unit.status,
		title: unit.title,
		responsibility: unit.responsibility,
		dependencies: unit.dependencies.map(({ unit: target, via }) => ({ unit: target, via })),
		scenarios: unit.scenarios,
		owns: unit.owns,
		contract: { inputs, outputs, errors },
		...(unit.helperContracts ? { helpers: unit.helperContracts } : {}),
		...(unit.catalog ? { catalog: unit.catalog } : {}),
		...(unit.configControls ? { configControls: unit.configControls } : {}),
		...(unit.preview ? { preview: unit.preview } : {}),
		...(unit.documentation
			? { documentation: { path: unit.documentation, examples: [], gap: 'Document not loaded.' } }
			: {}),
		runtime: {
			kind: unit.runtime.kind,
			targets: unit.runtime.targets.map(({ kind, entry }) => ({ kind, entry }))
		},
		budgets: unit.budgets,
		version: createHash('sha256')
			.update(canonicalJson([unit, files]))
			.digest('hex')
			.slice(0, 16)
	};
}

function scenarioView(scenario: ScenarioManifest): RevisionRegistry['scenarios'][number] {
	return {
		id: scenario.id,
		title: scenario.title,
		kind: scenario.kind,
		units: scenario.units,
		states: scenario.states.map(({ id, title, coverage, reason, units }) => ({
			id,
			title,
			coverage,
			...(reason ? { reason } : {}),
			...(units ? { units } : {})
		})),
		viewports: scenario.viewports,
		tests: scenario.tests.map(({ id, kind, runner }) => ({ id, kind, runner })),
		evidence: scenario.evidence.map(({ id, kind, states, viewports, required }) => ({
			id,
			kind,
			states,
			viewports,
			required
		}))
	};
}

export type { RevisionRegistry } from './revisionRegistry.types';
