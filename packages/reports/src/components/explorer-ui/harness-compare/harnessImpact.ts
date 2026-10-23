import type { ComparedSides, HarnessImpact } from '../../../utils/explorer-ui/harnessImpact';
import { sideImpact } from './sideImpact';
import type {
	HarnessMark,
	HarnessRevision,
	HarnessUnit
} from '../../../models/explorer-ui/Harness.types';
import type { HarnessClient } from '../../../utils/explorer-ui/harnessClient';

/**
 * What changed between two revisions. When a verification record of the head compared exactly
 * this base, its recorded impact is shown. Otherwise the two stored registries are compared:
 * units whose version differs are direct, and everything that depends on a changed, added or
 * removed unit in either graph is indirect.
 */
export function harnessImpact(
	base: HarnessRevision | undefined,
	head: HarnessRevision,
	compared?: ComparedSides | null
): HarnessImpact {
	const exact = compared && compared.base === base?.commit && compared.head === head.commit;
	const found = exact ? compared.impact : head.sourceImpact;
	return recordedImpact(base, head) ?? sourceImpact(base, found) ?? computedImpact(base, head);
}

/** Compares the stored sides of two revisions; undefined when either side was not stored. */
export async function comparedSides(
	client: HarnessClient,
	base: HarnessRevision,
	head: HarnessRevision
): Promise<ComparedSides | undefined> {
	if (!base.side || !head.side) return undefined;
	const [from, to] = await Promise.all([client.side(base.side), client.side(head.side)]);
	const impact = await sideImpact(
		{ commit: base.commit, side: from },
		{ commit: head.commit, side: to }
	);
	return { base: base.commit, head: head.commit, impact };
}

type Groups = Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;

const unique = (items: string[]) => [...new Set(items)].sort();

/** The impact a record of the head measured, when it compared exactly this base. */
function recordedImpact(
	base: HarnessRevision | undefined,
	head: HarnessRevision
): HarnessImpact | undefined {
	const recorded = head.comparison;
	if (!recorded || recorded.base !== base?.commit) return undefined;
	return {
		source: 'recorded',
		record: recorded.record,
		...sorted(recorded.units),
		scenarios: unique(recorded.scenarios ?? []),
		uncertain: recorded.uncertain ?? [],
		marks: marksOf(recorded.units)
	};
}

/** The impact the index computed from the source of the commit and of its first parent. */
function sourceImpact(
	base: HarnessRevision | undefined,
	found: HarnessRevision['sourceImpact']
): HarnessImpact | undefined {
	if (!found || !base || found.base !== base.commit) return undefined;
	return {
		source: 'source',
		expanded: found.expanded,
		files: found.changed.length,
		...sorted(found.units),
		scenarios: unique(found.scenarios),
		uncertain: found.uncertain,
		marks: marksOf(found.units)
	};
}

function computedImpact(base: HarnessRevision | undefined, head: HarnessRevision): HarnessImpact {
	const groups = computed(base, head);
	const touched = new Set(Object.values(groups).flat());
	const known = [...(base?.registry.scenarios ?? []), ...head.registry.scenarios];
	const scenarios = known.filter((scenario) => scenario.units.some((unit) => touched.has(unit)));
	return {
		source: 'computed',
		...sorted(groups),
		scenarios: unique(scenarios.map((scenario) => scenario.id)),
		uncertain: [],
		marks: marksOf(groups)
	};
}

/** One mark per unit; a unit in several groups keeps the strongest. */
function marksOf(groups: Groups): Map<string, HarnessMark> {
	const marks = new Map<string, HarnessMark>();
	for (const kind of ['indirect', 'direct', 'added', 'removed'] as const) {
		for (const unit of groups[kind]) marks.set(unit, kind);
	}
	return marks;
}

/** A new unit is listed as added, not also as changed. */
function sorted(groups: Groups): Groups {
	const added = new Set(groups.added);
	return {
		direct: unique(groups.direct.filter((unit) => !added.has(unit))),
		indirect: unique(groups.indirect),
		added: unique(groups.added),
		removed: unique(groups.removed)
	};
}

function computed(base: HarnessRevision | undefined, head: HarnessRevision): Groups {
	const before = new Map(active(base?.registry.units ?? []).map((unit) => [unit.id, unit]));
	const after = new Map(active(head.registry.units).map((unit) => [unit.id, unit]));
	const added = [...after.keys()].filter((id) => !before.has(id));
	const removed = [...before.keys()].filter((id) => !after.has(id));
	const direct = [...after.values()]
		.filter((unit) => before.has(unit.id) && before.get(unit.id)?.version !== unit.version)
		.map((unit) => unit.id);
	const changed = new Set([...added, ...removed, ...direct]);
	const indirect = dependents(changed, [...before.values(), ...after.values()]);
	return { direct, indirect, added, removed };
}

/** Units that reach a changed unit through dependencies, in either registry. */
function dependents(changed: Set<string>, units: HarnessUnit[]): string[] {
	const consumers = new Map<string, string[]>();
	for (const unit of units) {
		for (const { unit: target } of unit.dependencies) {
			consumers.set(target, [...(consumers.get(target) ?? []), unit.id]);
		}
	}
	const reached = new Set<string>();
	const queue = [...changed];
	while (queue.length > 0) {
		const next = (consumers.get(queue.pop() as string) ?? []).filter(
			(consumer) => !changed.has(consumer) && !reached.has(consumer)
		);
		for (const consumer of next) reached.add(consumer);
		queue.push(...next);
	}
	return [...reached];
}

function active(units: HarnessUnit[]): HarnessUnit[] {
	return units.filter((unit) => unit.status === 'active');
}
