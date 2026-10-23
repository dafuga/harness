import type { HarnessRecord, HarnessRevision } from '../../models/explorer-ui/Harness.types';

/** One revision of a comparison and the record of it that is looked at, if it has any. */
export interface ComparedSide {
	detail: HarnessRevision;
	record: HarnessRecord | null;
}

export interface StateChoice {
	scenario: string;
	state: string;
	viewport: string;
}

/** One recorded state on both sides, in words; a side without a capture says so. */
export interface AlignedState {
	key: string;
	label: string;
	before: string;
	after: string;
}

export {
	comparisonChoices,
	harnessComparison
} from '../../components/explorer-ui/harness-compare-media/harnessComparison';
