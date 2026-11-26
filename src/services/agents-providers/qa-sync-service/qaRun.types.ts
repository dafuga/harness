// @harness-uid u_ju2uomm6qz
import type {
	QaIssueLabels,
	QaSlackReader,
	QaSyncAction,
	QaSyncConfig,
	QaSyncReport,
	QaSyncStore,
	QaTrackerItem,
	QaTrackerNotes
} from '../../../core/agents-providers/qaSync.types';

export interface QaSyncPorts {
	slack: QaSlackReader;
	github: QaIssueLabels;
	tracker: QaTrackerNotes;
	state: QaSyncStore;
	now?: () => number;
}

export interface QaRun {
	config: QaSyncConfig;
	ports: QaSyncPorts;
	report: QaSyncReport;
	workspaceUrl: string;
	/** Listed at most once per run, and only when a comment needs routing. */
	items: () => Promise<QaTrackerItem[]>;
}

export type QaLabelRequest = Omit<Extract<QaSyncAction, { kind: 'label' }>, 'kind'>;
