import { expect, test } from 'vitest';
import {
	commitBranch,
	consoleCanonical,
	defaultCommit,
	type IndexedHistory
} from '../../src/utils/consoleCanonical';

const id = (letter: string) => letter.repeat(40);
const index: IndexedHistory = {
	branches: [
		{ name: 'feature/kept#1', head: id('d') },
		{ name: 'main', head: id('c') },
		{ name: 'old', head: id('z') }
	],
	revisions: [
		{ commit: id('d'), branches: ['feature/kept#1'] },
		{ commit: id('c'), branches: ['main'] },
		{ commit: id('b'), branches: ['feature/kept#1', 'main'] },
		{ commit: id('r'), branches: [], retained: true }
	]
};
const canonical = (address: string) =>
	consoleCanonical(index, new URL(`https://host${address}`), '/harness');

test('the root leads to the newest commit of the main branch', () => {
	expect(canonical('/harness')).toBe(`/harness/branch/main/commit/${id('c')}/map`);
	expect(canonical('/harness/')).toBe(`/harness/branch/main/commit/${id('c')}/map`);
	expect(defaultCommit({ ...index, branches: index.branches.slice(0, 1) }, '')).toBe(id('d'));
	expect(
		consoleCanonical({ branches: [], revisions: [] }, new URL('https://h/harness'), '/harness')
	).toBe(undefined);
});

test('the earlier query form leads to the page it named, with everything it carried', () => {
	expect(canonical(`/harness?view=history&commit=${id('b')}&unit=service.title`)).toBe(
		`/harness/branch/main/commit/${id('b')}/history/unit/service.title`
	);
	expect(canonical(`/harness?view=compare&base=${id('b')}&commit=${id('d')}`)).toBe(
		`/harness/branch/feature/kept%231/commit/${id('d')}/compare/${id('b')}`
	);
	// A commit no branch reaches gets no branch, and an unknown one falls back to the default.
	expect(canonical(`/harness?commit=${id('r')}&view=growth`)).toBe(
		`/harness/commit/${id('r')}/growth`
	);
	expect(canonical(`/harness?commit=${id('q')}`)).toBe(
		`/harness/branch/main/commit/${id('c')}/map`
	);
	expect(commitBranch(index, id('r'))).toBeNull();
});

test('a page path is left alone, and query parameters on one are folded into it', () => {
	const page = `/harness/branch/feature/kept%231/commit/${id('b')}/map`;
	expect(canonical(page)).toBeUndefined();
	expect(canonical(`${page}?unit=page.titles&view=growth`)).toBe(
		`/harness/branch/feature/kept%231/commit/${id('b')}/growth/unit/page.titles`
	);
	expect(canonical('/harness/branch/main/commit/short/map')).toBeUndefined();
});
