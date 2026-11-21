// @harness-uid u_dakcgp2ade
export type WatchdogCli = 'codex' | 'claude';

export type StartupPromptKind =
	| 'folder trust'
	| 'sign-in'
	| 'API key confirmation'
	| 'permission mode confirmation'
	| 'hook trust'
	| 'settings error';

export interface StartupDialog {
	cli: WatchdogCli;
	kind: StartupPromptKind;
	confirmable: boolean;
}

export interface WatchdogPane {
	name: string;
	key: string;
	activity: number;
	createdAt: number;
	live: boolean;
	runnerSocket: boolean;
	/** Readable in place, including when the window contains other panes. */
	readable: boolean;
	/** Readable and the only pane in the only window of this session. */
	ready: boolean;
	attached: boolean;
	currentCommand?: string;
	x: number;
	y: number;
	/** Current visible screen, read against an unchanged pane identity. */
	screen: string | null;
	cwd?: string;
}

export interface WatchdogNote {
	node: string;
	at: number;
	text: string;
}

export interface WatchdogItem {
	id: string;
	title: string;
	status: 'open' | 'in_progress' | 'blocked' | 'done' | 'ignored';
	deleted?: boolean;
	needsDaniel?: boolean;
	resolved?: boolean;
	question?: string | null;
	/** Notes in increasing hybrid-clock order. */
	notes?: readonly WatchdogNote[];
}

export interface WatchdogRun {
	id: number;
	itemId: string;
	state: 'queued' | 'running' | 'verifying' | 'finished' | 'observed';
	cli: WatchdogCli;
	tmux?: string | null;
	watchPane?: string | null;
	startedAt?: number | null;
	resumedAt?: number | null;
	endedAt?: number | null;
	outcome?: string | null;
	idleNudges?: number;
	idleNudgedAt?: number | null;
	idleEscalatedAt?: number | null;
}

export interface WatchdogScan {
	host: string;
	now: number;
	items: readonly WatchdogItem[];
	runs: readonly WatchdogRun[];
	panes: readonly WatchdogPane[];
	itemId?: string;
}
