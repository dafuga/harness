/** A bounded read loop with at most one probe in flight, and no signal authority. */
export interface BuildObservation {
	look(): Promise<boolean>;
	close(): void;
}

/** Rejection or timeout sticks as failure; a late probe cannot start another or clear it. */
export function buildObservation(
	read: (signal: AbortSignal) => Promise<boolean>
): BuildObservation {
	let pending: Promise<boolean> | null = null;
	let failed = false;
	const control = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let wake: (() => void) | undefined;
	const close = () => {
		failed = true;
		control.abort();
		clearTimeout(timer);
		wake?.();
	};
	return {
		look() {
			if (failed) return Promise.resolve(false);
			if (pending) return pending;
			const work = Promise.resolve()
				.then(() => (control.signal.aborted ? false : read(control.signal)))
				.catch(() => {
					close();
					return false;
				});
			const limit = new Promise<boolean>((resolve) => {
				wake = () => resolve(false);
				timer = setTimeout(() => {
					close();
					resolve(false);
				}, 5000);
			});
			pending = Promise.race([work, limit]);
			void work.then(() => {
				clearTimeout(timer);
				pending = null;
			});
			return pending;
		},
		close
	};
}

/** Finishing always answers; failed reads never turn into empty successful settlement. */
export async function finishObservation(
	settle: () => Promise<string | null>,
	reads: BuildObservation[]
): Promise<string | null> {
	try {
		if (!(await reads[0].look()))
			return 'Build process observation failed; shared or unknown processes were not signalled.';
		return await settle();
	} catch {
		return 'Build process settlement failed; shared or unknown processes were not signalled.';
	} finally {
		for (const read of reads) read.close();
	}
}
