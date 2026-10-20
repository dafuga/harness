import type { Shown } from '../../../../../src/workflows/runActivity';

/** How often an open, visible page reads the activity again. */
const every = 15_000;

/**
 * Reads the activity of this site again while its page is open: on request, every fifteen
 * seconds while the tab is visible, and when the tab becomes visible. It only reads; a reading
 * that does not arrive is reported, so the page can say that what it shows is getting old.
 */
export function activityClient(arrived: (shown: Shown) => void, missed: () => void) {
	let active = true;
	let pending = false;
	const controller = new AbortController();
	async function refresh(): Promise<void> {
		if (!active || pending) return;
		pending = true;
		try {
			const options = { cache: 'no-store' as const, signal: controller.signal };
			const response = await fetch('/api/project-activity', options);
			if (!response.ok) throw new Error('Activity unavailable.');
			const shown = (await response.json()) as Shown;
			if (active) arrived(shown);
		} catch {
			if (active) missed();
		} finally {
			pending = false;
		}
	}
	const visible = () => {
		if (document.visibilityState === 'visible') void refresh();
	};
	const timer = setInterval(visible, every);
	document.addEventListener('visibilitychange', visible);
	return {
		refresh,
		stop: () => {
			active = false;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', visible);
			controller.abort();
		}
	};
}
