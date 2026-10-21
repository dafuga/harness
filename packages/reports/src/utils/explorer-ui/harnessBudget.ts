import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';

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

/** What is known about the limit of one metric at a revision, beside the record's own finding. */
export interface Reviewed {
	/** True when the manifest declares the metric frozen; that alone freezes no number. */
	declared: boolean;
	/** The limit the ledger of the revision holds for it. */
	limit?: number;
	/** Why the ledger says it could not be measured when the limits were reviewed. */
	unmeasured?: string;
}

/**
 * The limit a line may claim. A number is shown only where one was reviewed: the baseline the
 * record judged the value against, else the limit in the ledger of the revision. A freeze the
 * manifest merely declares is said to be declared, with no reviewed limit recorded.
 */
function limitOf(
	found: Measurement | undefined,
	finding: Finding | undefined,
	known: Reviewed
): string {
	const reviewed = finding?.baseline ?? known.limit ?? null;
	if (reviewed !== null) return `frozen at ${reviewed}`;
	if (finding?.status === 'unavailable' || known.unmeasured) {
		return 'not frozen: reviewed as not measurable';
	}
	return unreviewed(found, known.declared);
}

/** A metric nobody reviewed: it has no value to freeze, or a freeze that is only declared. */
function unreviewed(found: Measurement | undefined, declared: boolean): string {
	if (found?.value === null) return 'not frozen: no value to freeze';
	return declared
		? 'freeze declared; no reviewed limit is recorded at this revision'
		: 'no limit is recorded at this revision';
}

/** What a value leaves out, and what the record found when it held it against a reviewed limit. */
function noted(found: Measurement, finding: Finding | undefined): string {
	const partial = found.partial ? `Partial: ${found.partial}` : '';
	const grew =
		finding?.status === 'exceeded' && finding.baseline !== null
			? `Grew from ${finding.baseline} to ${finding.measured} without a recorded approval.`
			: '';
	return [partial, grew].filter(Boolean).join(' ');
}

/**
 * How one frozen metric of a unit reads at a revision. A metric that cannot be measured is said
 * to be unavailable and not frozen; it is never shown as a zero that a limit holds in place.
 */
export function harnessBudget(
	found: Measurement | undefined,
	finding?: Finding,
	known: Reviewed = { declared: true }
): FrozenLine {
	const limit = limitOf(found, finding, known);
	if (!found) return { value: 'not measured at this revision', limit };
	if (found.value === null) {
		return { value: `unavailable: ${found.unavailable ?? 'no reason recorded'}`, limit };
	}
	const note = noted(found, finding);
	return { value: `${found.value} ${found.unitOfMeasure}`, limit, ...(note ? { note } : {}) };
}
