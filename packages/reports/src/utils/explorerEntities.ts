import { explorerCategories, explorerKindCategory } from '../../../../src/utils/explorerRoute';
import type { ExplorerEntity } from '../models/Explorer.types';
import type { HarnessMark, HarnessRevision, HarnessUnit } from '../models/Harness.types';
import { explorerCategory, explorerRole } from './explorerCategory';
import { explorerAppRoute, explorerName } from './explorerName';
import { explorerVerdict } from './explorer-verdict/explorerVerdict';

const marks: HarnessMark[] = ['added', 'direct', 'indirect', 'removed'];

/** How the commit of a revision changed a unit against its first parent, when it did. */
export function explorerChange(head: HarnessRevision, unit: string): HarnessMark | null {
	const units = head.sourceImpact?.units;
	return (units && marks.find((mark) => units[mark].includes(unit))) ?? null;
}

/** A listed entity, or an explicitly requested private callable; private units never enter collections. */
export function explorerEntity(
	head: HarnessRevision,
	unit: HarnessUnit,
	includePrivate = false
): ExplorerEntity | null {
	const privateFunction = includePrivate && explorerKindCategory(unit.kind) === 'functions';
	const category = explorerCategory(unit) ?? (privateFunction ? 'functions' : null);
	if (category === null) return null;
	return {
		id: unit.id,
		category,
		role: explorerRole(unit),
		name: explorerName(unit),
		purpose: unit.responsibility,
		unit,
		verdict: explorerVerdict(unit, head),
		change: explorerChange(head, unit.id),
		appRoute: explorerAppRoute(unit)
	};
}

/**
 * A unit the commit of a revision removed, as its first parent last held it: its last contract,
 * marked removed, and not proven because there is nothing of it at this commit to prove.
 */
function removedEntity(
	parent: HarnessRevision,
	unit: HarnessUnit,
	includePrivate = false
): ExplorerEntity | null {
	const last = explorerEntity(parent, unit, includePrivate);
	if (!last) return null;
	const why = `This commit removed it; its contract is shown as it last was, at ${parent.commit.slice(0, 7)}.`;
	return {
		...last,
		change: 'removed',
		lastAt: parent.commit,
		verdict: { passed: false, label: 'Removed at this commit', reasons: [why] }
	};
}

/** Resolve an explicit address, retaining a removed private unit only at its removal commit. */
export function explorerEntityAt(
	head: HarnessRevision,
	parent: HarnessRevision | null | undefined,
	id: string
): ExplorerEntity | null {
	const active = head.registry.units.find((unit) => unit.id === id && unit.status === 'active');
	if (active) return explorerEntity(head, active, true);
	if (!parent || !head.sourceImpact?.units.removed.includes(id)) return null;
	const prior = parent.registry.units.find((unit) => unit.id === id && unit.status === 'active');
	return prior ? removedEntity(parent, prior, true) : null;
}

/** The units the commit removed that its first parent held, when that revision was read. */
function removed(head: HarnessRevision, parent: HarnessRevision | null | undefined) {
	const gone = head.sourceImpact?.units.removed ?? [];
	// A unit that was retired stays in the registry as a tombstone: it is not held any more.
	const active = head.registry.units.filter((unit) => unit.status === 'active');
	const held = new Set(active.map((unit) => unit.id));
	return (parent?.registry.units ?? [])
		.filter((unit) => gone.includes(unit.id) && !held.has(unit.id) && unit.status === 'active')
		.map((unit) => removedEntity(parent as HarnessRevision, unit));
}

/**
 * The active units of a revision that are one of the five kinds, in the order of the categories
 * and then as the registry lists them. Each has its name, role, verdict and how the commit of the
 * revision changed it. With the first parent of a selected commit, the units that commit removed
 * are listed too, from the parent, so a removal can be seen where it happened. A unit of no
 * category is not among them; relations still name it.
 */
export function explorerEntities(
	head: HarnessRevision,
	parent?: HarnessRevision | null
): ExplorerEntity[] {
	const listed = [
		...head.registry.units
			.filter((unit) => unit.status === 'active')
			.map((unit) => explorerEntity(head, unit)),
		...removed(head, parent)
	].filter((entity): entity is ExplorerEntity => entity !== null);
	return explorerCategories.flatMap((category) =>
		listed.filter((entity) => entity.category === category)
	);
}
