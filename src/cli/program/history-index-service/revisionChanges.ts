import type {
	UnitVersions,
	Kind,
	ChangesInput,
	RevisionChanges
} from '../../../utils/revisionChanges';

/** What the versions of two registries say: a version changes with the manifest or an owned file. */
function versioned(before: UnitVersions, after: UnitVersions): Record<Kind, string[]> {
	const was = new Map(before.units.map((unit) => [unit.id, unit.version]));
	const is = new Map(after.units.map((unit) => [unit.id, unit.version]));
	return {
		added: [...is.keys()].filter((id) => !was.has(id)),
		removed: [...was.keys()].filter((id) => !is.has(id)),
		direct: [...is.keys()].filter((id) => was.has(id) && was.get(id) !== is.get(id))
	};
}

/**
 * Which units a commit changed against its first parent: those the stored source impact names
 * as changed, added or removed, and those whose registry version differs, which is how an edit
 * of a contract or of declared dependencies is seen. A unit that only depends on a changed one
 * is not among them. Null when neither an impact nor both registries are there to say.
 */
export function revisionChanges(input: ChangesInput): RevisionChanges | null {
	const { impact, registry, parent } = input;
	const versions = parent?.available && registry.available ? versioned(parent, registry) : null;
	if (!impact && !versions) return null;
	const named = (kind: Kind) =>
		[...new Set([...(impact?.units[kind] ?? []), ...(versions?.[kind] ?? [])])].sort();
	const [added, removed] = [named('added'), named('removed')];
	const moved = new Set([...added, ...removed]);
	return {
		base: impact?.base ?? input.base ?? null,
		direct: named('direct').filter((id) => !moved.has(id)),
		added,
		removed
	};
}
