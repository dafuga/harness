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
