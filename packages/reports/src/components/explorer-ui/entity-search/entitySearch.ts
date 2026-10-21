import type { SearchEntry } from '../../../utils/explorer-ui/entitySearch';
import { explorerCategories } from '../../../../../../src/utils/explorerRoute';

const order = new Map<string, number>(
	explorerCategories.map((category, index) => [category, index])
);

/** An entry as a query reads it: every text in lower case, its id and name also in parts. */
interface Read {
	name: string;
	id: string;
	parts: string[];
	words: string[];
	purpose: string;
	terms: string[];
}

function read(entry: SearchEntry): Read {
	const [name, id] = [entry.name.toLowerCase(), entry.id.toLowerCase()];
	const [purpose, terms] = [
		entry.purpose.toLowerCase(),
		entry.terms.map((term) => term.toLowerCase())
	];
	return { name, id, parts: id.split('.'), words: name.split(/\s+/), purpose, terms };
}

/** How a word can match, best first, each with its score: the first that holds counts. */
const tiers: Array<[score: number, holds: (entry: Read, word: string) => boolean]> = [
	[100, (entry, word) => entry.name === word || entry.id === word],
	[80, (entry, word) => entry.name.startsWith(word)],
	[
		70,
		(entry, word) => entry.id.startsWith(word) || entry.parts.some((part) => part.startsWith(word))
	],
	[60, (entry, word) => entry.words.some((part) => part.startsWith(word))],
	[40, (entry, word) => entry.name.includes(word) || entry.id.includes(word)],
	[20, (entry, word) => entry.purpose.includes(word)],
	[10, (entry, word) => entry.terms.some((term) => term.includes(word))]
];

/** How well one word of a query matches an entry; zero when it does not match at all. */
function scored(entry: Read, word: string): number {
	return tiers.find(([, holds]) => holds(entry, word))?.[0] ?? 0;
}

/**
 * The entries every word of the query matches, best first: names and ids before purposes and
 * contract names; equal matches keep the order of the categories, then of the names.
 */
export function entitySearch(entries: SearchEntry[], query: string, limit = 20): SearchEntry[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	const found: Array<{ entry: SearchEntry; score: number }> = [];
	for (const entry of entries) {
		const seen = read(entry);
		const scores = words.map((word) => scored(seen, word));
		if (scores.every(Boolean))
			found.push({ entry, score: scores.reduce((sum, value) => sum + value) });
	}
	const rank = (entry: SearchEntry) => order.get(entry.category) ?? order.size;
	found.sort(
		(left, right) =>
			right.score - left.score ||
			rank(left.entry) - rank(right.entry) ||
			left.entry.name.localeCompare(right.entry.name)
	);
	return found.slice(0, limit).map((item) => item.entry);
}
