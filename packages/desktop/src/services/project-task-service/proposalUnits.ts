import type { ComponentManifest } from "../../../../../src/lib/contracts";

/** Put units named in the question, or described by it, ahead of the bounded prompt list. */
export function taskUnits(units: ComponentManifest[], text: string): string[] {
	const words = (value: string) =>
		value
			.toLowerCase()
			.replace(/chat/g, 'conversation')
			.match(/[a-z0-9]+/g) ?? [];
	const ignored = new Set([
		'the',
		'and',
		'which',
		'what',
		'with',
		'from',
		'this',
		'that',
		'its',
		'for',
		'you',
		'unit',
		'registered',
		'component',
		'function',
		'page'
	]);
	const terms = new Set(words(text).filter((word) => word.length > 2 && !ignored.has(word)));
	const score = (unit: ComponentManifest) => {
		if (text.includes(unit.id)) return 10000;
		return (
			words(unit.title).reduce((sum, word) => sum + (terms.has(word) ? 8 : 0), 0) +
			words(unit.responsibility).reduce((sum, word) => sum + (terms.has(word) ? 1 : 0), 0)
		);
	};
	return [...units]
		.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
		.map((unit) => unit.id);
}
