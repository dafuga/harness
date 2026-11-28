// @harness-uid u_rzpjc6wqqy
import type { TaskSelection } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	TrackerDispatchOutcome,
	TrackerLaunchSource
} from '../TrackerDispatcherService.types';

/** Usage fields are supplied by the runner's receipt reader. Costs are recorded as supplied. */
export interface TrackerReceiptUsage {
	input_tokens?: number | null;
	output_tokens?: number | null;
	cache_read_tokens?: number | null;
	cache_write_tokens?: number | null;
	cost_usd?: number | null;
	credits_balance?: string | null;
}

/** Legacy run columns keep these receipts consumable by the Tracker analytics adapter. */
export interface TrackerRunReceipt extends TrackerReceiptUsage {
	node: string;
	id: number;
	item_id: string;
	auto_token: string;
	launch_source: TrackerLaunchSource;
	attempt: number;
	escalated_from: number | null;
	rung: string;
	cli: TaskSelection['provider'] | 'none';
	model: string;
	effort: string | null;
	pinned: boolean;
	kind: string | null;
	project: string | null;
	reason: string | null;
	/** The item's task type when this attempt was queued. */
	task_type?: string | null;
	state: 'queued' | 'running' | 'verifying' | 'finished';
	outcome: TrackerDispatchOutcome | null;
	failure_reason: string | null;
	exit_code?: number | null;
	queued_at: number;
	dispatch_at?: number;
	started_at: number | null;
	ended_at: number | null;
	resumed_at?: number;
	eta_at: number | null;
	verificationFor?: string;
	/** Retired legacy close timer: preserved from old rows, never set natively. */
	kill_at?: number;
	session_id?: string | null;
	session_name?: string | null;
	tmux?: string | null;
	/** The configured checkout the run was launched from; selects its verify command. */
	source_repo?: string | null;
	/** Host process identity for an adopted legacy receipt. */
	host_session_id?: string;
	redone_by?: string;
	revision: number;
}

export interface TrackerSessionEvidence {
	key: string;
	id: string;
	state: 'live' | 'exited' | 'lost';
	startedAt: number;
	tmux?: string;
	sourceRepo?: string;
	sessionName?: string;
}

export interface TrackerFinalReportEvent {
	type: 'final-report';
	outcome: 'blocked' | 'abandoned';
	reason: string;
}

export type TrackerDispatchEvent =
	| { type: 'session'; session: TrackerSessionEvidence }
	| {
			type: 'monitor';
			session: 'live' | 'exited' | 'lost' | 'unknown';
			activityAt?: number;
			exitCode?: number | null;
			verify?: boolean;
			idleReview?: boolean;
			usage?: TrackerReceiptUsage;
			diagnostic?: string;
	  }
	| {
			type: 'startup-failed';
			reason: string;
			exitCode?: number | null;
			/** The start call threw, so the session may still appear. */
			pending?: boolean;
	  }
	| { type: 'never-started' }
	| {
			type: 'verified';
			passed: boolean;
			reason?: string;
			note?: string;
			usage?: TrackerReceiptUsage;
	  }
	| { type: 'resume'; session: TrackerSessionEvidence }
	| { type: 'answered-without-session' }
	| TrackerFinalReportEvent
	| { type: 'reject'; reason: string };
