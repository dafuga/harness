import { createHash } from 'node:crypto';
import type { ComponentManifest, ScenarioManifest } from '../core/unitTypes';
import type { BudgetBaseline } from './budgetFindings';
import {
	emittedLimits,
	frozenLimits,
	type EmittedLimits,
	type FrozenLimits
} from './budgetReviews';
import { canonicalJson } from './canonicalJson';

export interface RevisionRegistry {
	/** False when the revision stores no unit registry; nothing is substituted for it. */
	available: boolean;
	gap?: string;
	units: Array<{
		id: string;
		kind: string;
		status: string;
		title: string;
		responsibility: string;
		dependencies: Array<{ unit: string; via: string }>;
		scenarios: string[];
		/** What the unit owns and promises, as its manifest states it at this revision. */
		owns: ComponentManifest['owns'];
		contract: Pick<ComponentManifest['contract'], 'inputs' | 'outputs' | 'errors'>;
		runtime: { kind: string; targets: Array<{ kind: string; entry: string }> };
		budgets: ComponentManifest['budgets'];
		/** For a unit that emits an output: the limit each target has in the ledger of this revision. */
		emitted?: EmittedLimits;
		/** The source limits the ledger of this revision holds; absent when none was reviewed yet. */
		limits?: FrozenLimits;
		/** Changes whenever the manifest or any owned file changes; equal versions are equal units. */
		version: string;
	}>;
	scenarios: Array<{
		id: string;
		title: string;
		kind: string;
		units: string[];
		states: Array<{ id: string; coverage: string; reason?: string }>;
		viewports: ScenarioManifest['viewports'];
		tests: Array<{ id: string; kind: string; runner: string }>;
		evidence: Array<{ id: string; kind: string; states: string[]; viewports: string[] }>;
	}>;
	graph: {
		nodes: Array<{ id: string; kind: 'unit' | 'scenario' }>;
		edges: Array<{ from: string; to: string; via: string }>;
	};
}

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
	const files = unit.owns.source.map((path) => `${path}:${blobs.get(path) ?? 'absent'}`);
	return {
		id: unit.id,
		kind: unit.kind,
		status: unit.status,
		title: unit.title,
		responsibility: unit.responsibility,
		dependencies: unit.dependencies.map(({ unit: target, via }) => ({ unit: target, via })),
		scenarios: unit.scenarios,
		owns: unit.owns,
		contract: { inputs, outputs, errors },
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
		states: scenario.states.map(({ id, coverage, reason }) => ({
			id,
			coverage,
			...(reason ? { reason } : {})
		})),
		viewports: scenario.viewports,
		tests: scenario.tests.map(({ id, kind, runner }) => ({ id, kind, runner })),
		evidence: scenario.evidence.map(({ id, kind, states, viewports }) => ({
			id,
			kind,
			states,
			viewports
		}))
	};
}
