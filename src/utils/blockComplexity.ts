const decisions = /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|(?<![?])\?(?![?.:,)\]=>;])/g;
const templateDecisions = /\{#(?:if|each|await)\b|\{:else if\b/g;

/** Counts decision points in masked source; functions start from a base of one. */
export function blockComplexity(masked: string, base: 0 | 1): number {
	return base + (masked.match(decisions)?.length ?? 0);
}

export function templateComplexity(markup: string): number {
	return markup.match(templateDecisions)?.length ?? 0;
}
