/** @pure */
export function featureSpecStructure(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('featureSpecStructure expects text');
	return textToFormat.trim();
}
