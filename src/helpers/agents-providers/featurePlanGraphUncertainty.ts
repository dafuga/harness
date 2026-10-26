/** @pure */
export function featurePlanGraphUncertainty(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('featurePlanGraphUncertainty expects text');
	return textToFormat.trim();
}
