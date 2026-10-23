export interface RunGate {
	/** The socket a run is given in `HARNESS_E2E_TEARDOWN_GATE`. */
	path: string;
	/** Resolves once the teardown of the run waits here, with the directory it would remove. */
	reached: Promise<string>;
	/** Lets the teardown remove its fixtures, now or as soon as it arrives. Repeating it is harmless. */
	release(): void;
	/** Lets every waiting teardown go and stops listening. Repeating it is harmless. */
	close(): Promise<void>;
}
