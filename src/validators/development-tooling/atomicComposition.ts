import { sharedPrimitivePath } from '../../core/development-tooling/composition';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

/** Native atoms are leaves; higher-level features never become a molecule's building block. */
export function compositionFindings(units: ComponentManifest[]): string[] {
	const levels = new Map(units.map((unit) => [unit.id, unit.composition?.level]));
	return units.flatMap((unit) =>
		unit.dependencies.flatMap((dependency) => {
			if (!composedDependency(unit, dependency)) return [];
			const own = unit.composition?.level;
			const child = levels.get(dependency.unit);
			if (!own || !child || dependency.unit === unit.id) return [];
			return invalidComposition(own, child)
				? [`${unit.id}: ${own} cannot compose ${child} ${dependency.unit}`]
				: [];
		})
	);
}

function composedDependency(
	unit: ComponentManifest,
	dependency: ComponentManifest['dependencies'][number]
) {
	return unit.composition?.uses
		? unit.composition.uses.includes(dependency.unit)
		: dependency.origin === 'derived' &&
				['import', 'dynamic-import', 'reexport'].includes(dependency.via);
}

function invalidComposition(own: string, child: string) {
	switch (own) {
		case 'atom':
			return true;
		case 'molecule':
			return child !== 'atom';
		case 'organism':
			return ['layout', 'page'].includes(child);
		case 'layout':
			return child === 'page';
		default:
			return false;
	}
}

/** Contracts name exactly the shared primitives their source composes. */
export function sharedPrimitiveFindings(units: ComponentManifest[]): string[] {
	const primitives = new Set(
		units
			.filter((unit) => unit.owns.source.some((path) => sharedPrimitivePath.test(path)))
			.map((unit) => unit.id)
	);
	return units
		.filter((unit) => unit.kind === 'component')
		.flatMap((unit) => {
			const expected = (unit.composition?.uses ?? []).filter((id) => primitives.has(id));
			const declared = unit.contract.primitives ?? [];
			const missing = expected.filter((id) => !declared.includes(id));
			const extra = declared.filter(
				(id, index) => !expected.includes(id) || declared.indexOf(id) !== index
			);
			return [
				...missing.map((id) => `${unit.id}: contract omits shared primitive ${id}`),
				...extra.map((id) => `${unit.id}: contract lists unused shared primitive ${id}`)
			];
		});
}
