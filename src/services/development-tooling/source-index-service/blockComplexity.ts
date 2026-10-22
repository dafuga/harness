const templateDecisions = /\{#(?:if|each|await)\b|\{:else if\b/g;

export function templateComplexity(markup: string): number {
	return markup.match(templateDecisions)?.length ?? 0;
}
