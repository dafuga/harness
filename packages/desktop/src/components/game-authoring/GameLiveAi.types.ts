// @harness-uid u_hq2m7zd4bx
export interface GameLiveAiProps {
	/** The AI video models by key, each with its label and its price in dollars per minute. */
	models: Record<string, { label: string; rate: number }>;
	/** The chosen model's key, bindable. */
	choice?: string;
	/** The most seconds one AI video run may last. */
	limit: number;
	/** The chosen model's price in dollars per minute. */
	rate: number;
	/** False when Live AI is not configured, the view is read-only or no project is open. */
	available: boolean;
	/** True while an AI video run is starting or live. */
	busy: boolean;
	/** The one quiet line on why the control is off or how the run is going; empty otherwise. */
	status: string;
	/** A failure to start the AI video, shown in the dialog. */
	error: string;
	start: () => void;
	stop: () => void;
}
