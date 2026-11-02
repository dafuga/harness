// @harness-uid u_kncajdgbbv
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { SourceFile } from '../../../core/development-tooling/sourceTypes';

// This first reviewed cohort keeps other candidate cycles open for semantic owner review.
const canonicalOwners = new Set([
	'function.scan-imports',
	'function.validation',
	'function.scenario-coverage',
	'service.source-graph',
	'reports.function.reports-media-admit-upload-request',
	'validator.unit-registry',
	'reports.component.select',
	'reports.component.modal',
	'reports.component.filter-dialog',
	'reports.component.brand-mark',
	'reports.component.shared-primitives-data-table',
	'reports.component.shared-primitives-code-line',
	'reports.component.shared-primitives-detail-list'
]);

/** Identity is unique across active units; reviewed owners do not import their own facades. */
export function registryOwnershipFindings(
	identifiers: string[],
	units: ComponentManifest[],
	sources?: ReadonlyMap<string, SourceFile>
): string[] {
	const duplicates = duplicateIdentities(identifiers);
	if (!sources) return duplicates;
	return [
		...duplicates,
		...units
			.filter((unit) => canonicalOwners.has(unit.id))
			.flatMap((unit) => canonicalFindings(unit, sources))
	];
}

function duplicateIdentities(identifiers: string[]): string[] {
	const seen = new Set<string>(),
		repeated = new Set<string>();
	for (let position = 0; position < identifiers.length; position++) {
		const id = identifiers[position];
		if (seen.has(id)) repeated.add(id);
		seen.add(id);
	}
	return [...repeated].map((id) => `Duplicate active unit id ${id}`);
}

function canonicalFindings(
	unit: ComponentManifest,
	sources: ReadonlyMap<string, SourceFile>
): string[] {
	const owned = new Set(unit.owns.source);
	return unit.owns.source.flatMap((path) => {
		const file = sources.get(path);
		if (!file) return [];
		if (!file.read)
			return [`${unit.id}: cannot inspect canonical dependencies of unread source ${path}`];
		if (file.language === 'svelte' && path !== unit.runtime.entry) return [];
		return file.references
			.filter(
				(reference) =>
					!reference.typeOnly &&
					reference.path &&
					reference.path !== path &&
					['import', 'dynamic-import'].includes(reference.via) &&
					forwardTargets(reference.path, owned, sources).has(path)
			)
			.map(
				(reference) =>
					`${unit.id}: canonical ${path} runtime-imports forwarding entry ${reference.path}`
			);
	});
}

function forwardTargets(
	start: string,
	owned: ReadonlySet<string>,
	sources: ReadonlyMap<string, SourceFile>
): Set<string> {
	const seen = new Set<string>(),
		pending = [start];
	while (pending.length) {
		const path = pending.pop()!;
		if (!owned.has(path) || seen.has(path)) continue;
		seen.add(path);
		const file = sources.get(path);
		if (file) pending.push(...forwardingPaths(file));
	}
	return seen;
}

function forwardingPaths(file: SourceFile): string[] {
	return file.references
		.filter(
			(reference) =>
				!reference.typeOnly &&
				reference.path &&
				(reference.via === 'reexport' || (file.language === 'svelte' && reference.via === 'import'))
		)
		.map((reference) => reference.path!);
}
