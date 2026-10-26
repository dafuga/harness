/** @pure */
export function moduleTaskExecution(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskExecution expects text');
	return textToFormat.trim();
}
