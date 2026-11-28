/**
 * Whether a Tracker note is a handoff a later session resumes from.
 * @pure
 */
export function isTrackerResumeNote(text: string): boolean {
	return /^stopped:.*?\bresume from\s*:/is.test(text);
}
