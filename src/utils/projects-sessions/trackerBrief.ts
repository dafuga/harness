// @harness-uid u_4pgfvaopdt
/** The item's first BRIEF note, which states what the work is. */
export function trackerBrief(notes: readonly { text: string }[]): string | null {
	return notes.find(({ text }) => text.startsWith('BRIEF'))?.text ?? null;
}
