import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';

export type Measurement = HarnessRecord['measurements'][number];

export type Finding = HarnessRecord['budgets']['findings'][number];

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
