import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

/** Native atoms are leaves; higher-level features never become a molecule's building block. */
export function compositionFindings(units: ComponentManifest[]): string[] {
	const levels = new Map(units.map((unit) => [unit.id, unit.composition?.level]));
	return units.flatMap((unit) =>
		unit.dependencies.flatMap((dependency) => {
			if (
				unit.composition?.uses
					? !unit.composition.uses.includes(dependency.unit)
					: dependency.origin !== 'derived' ||
						!['import', 'dynamic-import', 'reexport'].includes(dependency.via)
			)
				return [];
			const own = unit.composition?.level;
			const child = levels.get(dependency.unit);
			if (!own || !child || dependency.unit === unit.id) return [];
			const invalid =
				own === 'atom' ||
				(own === 'molecule' && child !== 'atom') ||
				(own === 'organism' && ['layout', 'page'].includes(child)) ||
				(own === 'layout' && child === 'page');
			return invalid ? [`${unit.id}: ${own} cannot compose ${child} ${dependency.unit}`] : [];
		})
	);
}
