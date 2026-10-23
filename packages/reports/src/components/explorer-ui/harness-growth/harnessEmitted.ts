import { metric, order } from '../../../utils/explorer-ui/harnessEmitted';
import type { HarnessIndex } from '../../../models/explorer-ui/Harness.types';

/** The targets a unit has a size, a note or a review for anywhere in the history. */
export function emittedTargets(index: HarnessIndex, unit: string): string[] {
	const found = index.units.find((item) => item.id === unit);
	const named = new Set<string>();
	for (const point of found?.growth ?? []) {
		for (const target of Object.keys(point.emitted ?? {})) named.add(target);
		for (const key of Object.keys(point.notes ?? {})) named.add(key.replace(`${metric}:`, ''));
	}
	return order.filter((target) => named.has(target));
}
