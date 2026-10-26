/** @pure */
export function moduleTaskApprovedSubmission(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskApprovedSubmission expects text');
	return textToFormat.trim();
}
