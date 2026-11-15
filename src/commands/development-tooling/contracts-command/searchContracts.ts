// @harness-uid u_gbvrpedrgl
import { fail } from '../../../core/development-tooling/errors';
import { contractSummary } from './contractSelection';
import type {
	ContractEntry,
	ContractField,
	ContractMatch,
	ContractOptions
} from './contracts.types';

/** Search only values from stored contracts; identity matches precede descriptive matches. */
export function searchContracts(
	entries: ContractEntry[],
	query: string,
	options: ContractOptions
): ContractMatch[] {
	if (!query.length) return fail('Contract search query must not be empty.');
	const match = matcher(query, options);
	return entries
		.flatMap((entry) => {
			const found = contractFields(entry)
				.flatMap((field) => {
					const index = match(field.text);
					if (index < 0) return [];
					const exact = field.text.length === query.length ? 40 : 0;
					return [{ ...field, index, score: field.weight + exact + (index === 0 ? 20 : 0) }];
				})
				.sort((left, right) => right.score - left.score || left.field.localeCompare(right.field));
			const best = found[0];
			return best
				? [
						{
							...contractSummary(entry),
							field: best.field,
							score: best.score,
							snippet: snippet(best.text, best.index)
						}
					]
				: [];
		})
		.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
		.slice(0, options.limit ?? 20);
}

function matcher(query: string, options: ContractOptions): (text: string) => number {
	if (options.regex) {
		let expression: RegExp;
		try {
			expression = new RegExp(query, options.ignoreCase ? 'i' : '');
		} catch {
			return fail(`Invalid regular expression: ${query}`);
		}
		return (text) => expression.exec(text)?.index ?? -1;
	}
	const needle = options.ignoreCase ? query.toLowerCase() : query;
	return (text) => (options.ignoreCase ? text.toLowerCase() : text).indexOf(needle);
}

function contractFields(entry: ContractEntry): ContractField[] {
	return [
		{ field: 'id', text: entry.id, weight: 600 },
		{ field: 'title', text: entry.title, weight: 500 },
		{ field: 'responsibility', text: entry.responsibility, weight: 400 },
		...values(entry.manifest.contract, 'contract', 200),
		...values(entry.manifest.helperContracts, 'helperContracts', 200),
		...values(entry.manifest.dependencies, 'dependencies', 150),
		...values(entry.manifest.scenarios, 'states', 150),
		...values(entry.states, 'states', 150),
		...values(entry.manifest.owns, 'owns', 100)
	];
}

function values(data: unknown, field: string, weight: number): ContractField[] {
	if (data === undefined || data === null) return [];
	if (typeof data !== 'object') return [{ field, text: String(data), weight }];
	return Object.entries(data).flatMap(([key, value]) => values(value, `${field}.${key}`, weight));
}

function snippet(text: string, index: number): string {
	const start = Math.max(0, index - 45);
	const end = Math.min(text.length, start + 160);
	return `${start ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}
