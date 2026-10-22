const decisions = /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|(?<![?])\?(?![?.:,)\]=>;])/g;

/** Counts decision points in masked source; functions start from a base of one. */
export function blockComplexity(masked: string, base: 0 | 1): number {
	return base + (masked.match(decisions)?.length ?? 0);
}

export { templateComplexity } from '../../services/development-tooling/source-index-service/blockComplexity';
