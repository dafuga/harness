// @harness-uid u_gs5pnxnxt4
import type { TrackerModelItem } from './classifyTrackerTask.types';
import { parseTrackerModelSpec } from './parseTrackerModelSpec';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import type { TrackerModelSelection } from './pickTrackerModel.types';

/** The item's model was named with --model, so it is the operator's own choice. */
export function hasExplicitModel({ model, explicit_model: named }: TrackerModelItem) {
	return Boolean(model) && model === named;
}

/** An explicit --model always wins: no provider preference, floor or climb replaces it. */
export function explicitModelSelection(
	item: TrackerModelItem,
	ladder: readonly TrackerModelRung[],
	kind: TrackerModelSelection['kind']
) {
	if (!hasExplicitModel(item)) return undefined;
	const rung = parseTrackerModelSpec(item.model!, ladder);
	return { rung, kind, reason: `named on the item (${item.model}); explicit --model wins` };
}
