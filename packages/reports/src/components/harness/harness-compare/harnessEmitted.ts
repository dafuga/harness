import { EmittedChange, targetsOf, order, emittedLabel, built } from '../../../utils/harnessEmitted';
import type { HarnessRecord, HarnessUnit } from "../../../models/Harness.types.ts";

/** The emitted size of each target of a unit on both sides of a comparison. */
export function emittedChange(
	unit: string,
	sides: Array<{ units: HarnessUnit[]; record: HarnessRecord | null }>
): EmittedChange[] {
	const declared = sides.flatMap((side) => {
		const found = side.units.find((item) => item.id === unit);
		return found ? targetsOf(found) : [];
	});
	const [base, head] = sides;
	return order
		.filter((target) => declared.includes(target))
		.map((target) => ({
			target,
			label: emittedLabel(target),
			before: built(base?.record ?? null, unit, target)?.value ?? null,
			after: built(head?.record ?? null, unit, target)?.value ?? null
		}));
}
