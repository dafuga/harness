/** @pure */
export function moduleTaskBrokerContracts(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskBrokerContracts expects text');
	return textToFormat.trim();
}
