export interface TrackerClaudeStartupProbe {
	tmux: string;
	socket: string;
	live: boolean;
	/** The attempt directory. */
	directory: string;
}
