import type { RecordedNode } from '../../../utils/shared-primitives/recordedValue';
import { read } from '../../../utils/shared-primitives/recordedValue';

/** At most four levels, twelve items per collection and 120 expanded values. */
export function recordedValue(value: unknown): RecordedNode {
	return read(value, 0, { left: 120 });
}
