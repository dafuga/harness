// @harness-uid u_okueohjk4j
/** Two one-tap answers for a yes-or-no question; open questions get none. */
export function quickReplies(question: string | null) {
	const text = question?.trim() ?? '';
	if (!text.endsWith('?') || /\bor\b/i.test(text)) return [];
	if (/^(approve|merge|deploy|ship|release)\b/i.test(text)) return ['Approve', 'Not yet'];
	return /^(should|can|may|shall|do|does|did|is|are|will|would)\b/i.test(text) ? ['Yes', 'No'] : [];
}
