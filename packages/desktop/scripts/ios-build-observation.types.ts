/** A bounded read loop with at most one probe in flight, and no signal authority. */
export interface BuildObservation {
	look(): Promise<boolean>;
	close(): void;
}
