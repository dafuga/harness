// @harness-uid u_zcznmmfcdc
export type CanarySurface = 'web' | 'mac' | 'iphone';

/** Runs one `tracker` command with `--json` and returns the parsed reply. */
export type CanaryTracker = (args: string[]) => Promise<CanaryItem>;

export interface CanaryItem {
	id: string;
	status?: string;
	blocked_reason?: string | null;
	question?: string | null;
	needs_daniel?: boolean;
	answer?: string | null;
	answered_by?: string | null;
	answered_at?: string | null;
	answer_option?: number | string | null;
}

/** The script's own tab on production Hub. */
export interface CanaryWeb {
	signedIn(): Promise<boolean>;
	/** The labels on the needs-you row holding `marker`, or null while there is no such row. */
	row(marker: string): Promise<string[] | null>;
	press(marker: string, label: string): Promise<boolean>;
	reload(): Promise<void>;
	close(): Promise<void>;
}

export interface CanaryClock {
	now(): number;
	wait(ms: number): Promise<void>;
}

export interface CanaryOptions {
	release: string;
	/** Surfaces Daniel answers by hand in this run. */
	taps: ReadonlySet<CanarySurface>;
	tracker: CanaryTracker;
	/** Opens the production tab. Rejects when the browser cannot be reached. */
	web: () => Promise<CanaryWeb>;
	clock: CanaryClock;
	/** A short random word that tells this run's asks apart. */
	nonce: () => string;
	/** A number from 0 up to, not including, `count`. */
	pick: (count: number) => number;
	log: (line: string) => void;
	tapTimeoutMs?: number;
}

export type CanaryState = 'passed' | 'failed' | 'not-seen';

export interface CanaryResult {
	surface: CanarySurface;
	state: CanaryState;
	detail: string;
	itemId?: string;
}

export interface CanaryReport {
	passed: boolean;
	results: CanaryResult[];
}

export interface CanaryAsk {
	surface: CanarySurface;
	marker: string;
	title: string;
	question: string;
	labels: string[];
	/** The 1-based number of the option to answer with. */
	expected: number;
}

export interface CanaryOutcome {
	state: CanaryState;
	detail: string;
}

export interface CdpReply {
	id?: number;
	error?: { message: string };
	result?: Record<string, unknown>;
}
