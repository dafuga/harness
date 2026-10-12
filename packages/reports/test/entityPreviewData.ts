import type { HarnessExplanation, HarnessRecord } from '../src/models/Harness.types';
import { record } from './entityFixture';
import { capture, ids } from './entityUnits';

/** What a preview is asked to show beside the plain history: named in the address it opens at. */
export type PreviewVariant = '' | 'legacy' | 'partial' | 'declared';

/**
 * The record of a commit as the preview shows it: the search scenario also recorded a spoken
 * clip of its matching state. `whole` is whether every required state of the page was captured.
 */
export function previewRecord(commit: string, whole = true): HarnessRecord {
	const taken = record(commit, whole);
	taken.scenarios[1].states[0].captures.push(capture(commit, { kind: 'audio', state: 'match' }));
	return taken;
}

const inventory = Array.from({ length: 70 }, (_, order) => `unit ${order + 1}`).join(', ');
const tried = 'Registration only; implementation unchanged.';

/**
 * Reasons as a history holds them from before notes were limited: four functions of one unit,
 * each repeating an inventory of everything its commit registered. Invented text, at the length
 * and in the shape of the analytics CPU client history that the limits were written for.
 */
export const legacyReasons: HarnessExplanation[] = [
	'cpuSample',
	'cpuClient',
	'cpuGroups',
	'cpuHistory'
].map((symbol) => ({
	unit: ids.filter,
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `Register ${symbol} of the analytics CPU client beside ${inventory}.`,
	simplification: { attempt: tried, outcome: 'not-applicable' },
	performance: {
		attempt: symbol === 'cpuHistory' ? `Sampled once a second instead of ${inventory}.` : tried,
		outcome: symbol === 'cpuHistory' ? 'improved' : 'not-applicable'
	}
}));

/** A contract as a person declared it for the page: each item says in words what it is. */
export const declaredContract = {
	inputs: [
		{ name: 'branch', type: 'string', description: 'The branch, as one encoded path segment.' },
		{
			name: 'commit',
			type: 'hash | absent',
			description: 'The selected commit; absent at the tip.'
		}
	],
	outputs: [{ name: '+page', type: 'markup', description: 'The orders of an account as a list.' }],
	errors: [
		{
			name: 'not-at-revision',
			type: 'notice',
			description: 'A missing page is said, not replaced.'
		}
	]
};
