export interface FailureCause {
	/** The failure as recorded; for a cause several subjects share, the words they share. */
	text: string;
	count: number;
	/** The first subjects a shared cause was recorded for; empty for a failure of its own. */
	subjects: string[];
}

export interface FailureSummary {
	total: number;
	/** True when the failures are few enough to be read as they are, without a summary. */
	plain: boolean;
	/** The causes that are shown, in the order they first occur. */
	causes: FailureCause[];
	/** Causes beyond those shown; like every failure they are in the complete list. */
	more: number;
}

export { harnessFailures } from '../../components/explorer-ui/harness/harness-failures/harnessFailures';
