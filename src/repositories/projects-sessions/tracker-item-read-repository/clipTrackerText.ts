// @harness-uid u_gpa4vx5ggo
/** @pure Flatten text to one line and mark where it was shortened. */
export function clipTrackerText(text: string, length: number): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}
