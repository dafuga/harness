import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';

export type Measurement = HarnessRecord['measurements'][number];

export interface EmittedLine {
	target: string;
	label: string;
	/** The measured bytes, or the statement that there are none and why. */
	value: string;
	/** The limit this revision freezes for the target, or that it freezes none. */
	limit: string;
	/** What the record found when it judged the size against that limit. */
	note?: string;
}

export interface EmittedChange {
	target: string;
	label: string;
	before: number | null;
	after: number | null;
}
