import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';

export type Scenario = HarnessRecord['scenarios'][number];

export type CaptureStanding = 'fresh' | 'inherited' | 'rejected' | 'unvalidated';

export interface CaptureProvenance {
	standing: CaptureStanding;
	/** Short statement of the standing, shown wherever the capture appears. */
	label: string;
	facts: Array<{ label: string; value: string }>;
	/** The same facts as sentences, with complete revisions. */
	note: string;
}
