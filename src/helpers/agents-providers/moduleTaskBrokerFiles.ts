/** @pure */
export function moduleTaskBrokerFiles(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskBrokerFiles expects text');
	return textToFormat.trim();
}
