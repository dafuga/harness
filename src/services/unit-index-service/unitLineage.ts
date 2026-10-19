import type { LineageSubject } from '../../utils/unitLineage';
import type { ComponentManifest } from '../../core/unitTypes';

/**
 * Retired identities a unit continues: it exposes the same symbols, or it reuses the retired
 * name with a numeric suffix. Budget and reason history follows these links, so retiring a unit
 * and recreating it elsewhere cannot start from a blank baseline.
 */
export function unitLineage(unit: LineageSubject, retired: ComponentManifest[]): string[] {
	const symbols = unit.symbols.join('\n');
	return retired
		.filter((candidate) => candidate.status === 'retired' && candidate.id !== unit.id)
		.filter((candidate) => sameSymbols(candidate, symbols) || reusesName(unit.id, candidate.id))
		.map((candidate) => candidate.id)
		.sort();
}

function sameSymbols(candidate: ComponentManifest, symbols: string): boolean {
	return symbols.length > 0 && candidate.owns.symbols.join('\n') === symbols;
}

function reusesName(id: string, retired: string): boolean {
	return id.startsWith(`${retired}-`) && /^\d+$/.test(id.slice(retired.length + 1));
}
