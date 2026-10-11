import type { HarnessRecord } from '../models/Harness.types';

type Measurement = HarnessRecord['measurements'][number];
type Finding = HarnessRecord['budgets']['findings'][number];

export interface FrozenLine {
	/** The measured value with its unit, or the statement that there is none and why. */
	value: string;
	/** What limit applies: a number, none yet, or none because nothing can be measured. */
	limit: string;
	/** What a value leaves out, when only part of the unit could be measured. */
	note?: string;
}

/**
 * How one frozen metric of a unit reads at a revision. A metric that cannot be measured is said
 * to be unavailable and not frozen; it is never shown as a zero that a limit holds in place.
 */
export function harnessBudget(found: Measurement | undefined, finding?: Finding): FrozenLine {
	if (!found) return { value: 'not measured at this revision', limit: 'frozen' };
	if (found.value === null) return unavailable(found, finding);
	const baseline = finding?.baseline ?? null;
	const limit = baseline === null ? 'frozen' : `frozen at ${baseline}`;
	const note = found.partial ? { note: `Partial: ${found.partial}` } : {};
	return { value: `${found.value} ${found.unitOfMeasure}`, limit, ...note };
}

function unavailable(found: Measurement, finding?: Finding): FrozenLine {
	const reviewed = finding?.status === 'unavailable';
	return {
		value: `unavailable: ${found.unavailable ?? 'no reason recorded'}`,
		limit: reviewed ? 'not frozen: reviewed as not measurable' : 'not frozen: no value to freeze'
	};
}
