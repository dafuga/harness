// @harness-uid u_rkbdpu2tbn
const clockPattern = /^(\d{15})-(\d{6})-.+$/;

export function trackerClockMilliseconds(value: string): number {
	return Number(clockPattern.exec(value)?.[1] ?? 0);
}

/** Issue a fixed-width hybrid logical clock after the last durable operation. */
export function nextTrackerClock(node: string, now: number, floor: string | null): string {
	const previous = clockPattern.exec(floor ?? '');
	const previousMilliseconds = Number(previous?.[1] ?? 0);
	let milliseconds = Math.max(now, previousMilliseconds);
	let counter = now > previousMilliseconds ? 0 : Number(previous?.[2] ?? 0) + 1;
	if (counter > 999999) {
		milliseconds += 1;
		counter = 0;
	}
	return `${String(milliseconds).padStart(15, '0')}-${String(counter).padStart(6, '0')}-${node}`;
}
