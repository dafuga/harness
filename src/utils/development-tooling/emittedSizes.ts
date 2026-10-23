import type { Sized } from './emittedSizes.types';
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';

/** The size of what a unit emits. It is frozen once for every execution target, never as a sum. */
export const emittedMetric = 'artifact-bytes';

/** The name an emitted size is frozen under in the ledger: one limit per unit and target. */
export const emittedKey = (target: string): string => `${emittedMetric}:${target}`;

/**
 * The emitted sizes that are frozen: those measured from the build of the verified snapshot, one
 * for each execution target. A size that a benchmark reports about its own run carries a machine
 * profile and is not one of them, and a unit that emits nothing has no target to name.
 */
export function emittedSizes<Item extends Sized>(
	measurements: Item[]
): Array<Item & { target: RuntimeKind }> {
	return measurements.filter(
		(item): item is Item & { target: RuntimeKind } =>
			item.metric === emittedMetric && item.target !== undefined && !item.profile && !item.workload
	);
}
