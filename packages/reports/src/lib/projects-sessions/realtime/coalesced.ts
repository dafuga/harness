/**
 * Runs `work` one flight at a time. Calls made during a flight share one more flight after it,
 * so a burst of changes costs two reads and the last read always starts after the last change.
 */
export function coalesced(work: () => Promise<unknown>): () => Promise<void> {
	let flight: Promise<void> | null = null;
	let again = false;
	const drain = async () => {
		do {
			again = false;
			await work().catch(() => undefined);
		} while (again);
		flight = null;
	};
	return () => {
		if (flight) again = true;
		else flight = drain();
		return flight;
	};
}
