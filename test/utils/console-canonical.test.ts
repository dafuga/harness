import { expect, test } from 'vitest';
import {
	commitBranch,
	consoleCanonical,
	defaultCommit,
	type IndexedHistory
} from '../../src/utils/console-canonical/consoleCanonical';

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
		{ commit: id('r'), branches: [], retained: true },
		{ commit: id('e'), branches: [], retained: true }
	]
};
const canonical = (address: string) =>
	consoleCanonical(index, new URL(`https://host${address}`), '/harness');

test('the root leads to Pages at the tip of the main branch', () => {
	expect(canonical('/harness')).toBe('/harness/branch/main/pages');
	expect(canonical('/harness/')).toBe('/harness/branch/main/pages');
	expect(defaultCommit({ ...index, branches: index.branches.slice(0, 1) }, '')).toBe(id('d'));
	expect(
		consoleCanonical({ branches: [], revisions: [] }, new URL('https://h/harness'), '/harness')
	).toBe(undefined);
});

test('without a main branch the root leads to the first branch whose tip is indexed', () => {
	const others = { ...index, branches: [index.branches[2], index.branches[0]] };
	expect(consoleCanonical(others, new URL('https://h/harness'), '/harness')).toBe(
		'/harness/branch/feature%2Fkept%231/pages'
	);
	const retained = { branches: [], revisions: [index.revisions[3]] };
	expect(consoleCanonical(retained, new URL('https://h/harness'), '/harness')).toBe(
		`/harness/commit/${id('r')}/pages`
	);
});

test('a branch or a commit alone leads to its Pages', () => {
	expect(canonical('/harness/branch/main')).toBe('/harness/branch/main/pages');
	expect(canonical('/harness/branch/feature%2Fkept%231')).toBe(
		'/harness/branch/feature%2Fkept%231/pages'
	);
	expect(canonical(`/harness/branch/main/commit/${id('b')}`)).toBe(
		`/harness/branch/main/commit/${id('b')}/pages`
	);
});

test('the earlier query form leads to the entity it named', () => {
	expect(canonical(`/harness?view=history&commit=${id('b')}&unit=service.title`)).toBe(
		`/harness/branch/main/commit/${id('b')}/services/service.title/history`
	);
	expect(canonical(`/harness?view=compare&base=${id('b')}&commit=${id('d')}`)).toBe(
		`/harness/branch/feature%2Fkept%231/commit/${id('d')}/pages`
	);
	// A commit no branch reaches gets no branch, and an unknown one falls back to the tip.
	expect(canonical(`/harness?commit=${id('r')}&view=growth`)).toBe(
		`/harness/commit/${id('r')}/pages`
	);
	expect(canonical(`/harness?commit=${id('q')}`)).toBe('/harness/branch/main/pages');
	expect(canonical('/harness?view=map&unit=function.slugify')).toBe(
		'/harness/branch/main/functions/function.slugify'
	);
	expect(commitBranch(index, id('r'))).toBeNull();
});

test('an earlier page path leads into the explorer, with the query folded into it', () => {
	const page = `/harness/branch/feature/kept%231/commit/${id('b')}`;
	const scope = `/harness/branch/feature%2Fkept%231/commit/${id('b')}`;
	expect(canonical(`${page}/map`)).toBe(`${scope}/pages`);
	expect(canonical(`${page}/compare/${id('d')}/unit/page.titles`)).toBe(
		`${scope}/pages/page.titles`
	);
	expect(canonical(`${page}/history/record/r1`)).toBe(`${scope}/pages`);
	expect(canonical(`${page}/growth/unit/function.slugify`)).toBe(
		`${scope}/functions/function.slugify/history`
	);
	expect(canonical(`${page}/activity`)).toBe(`${scope}/pages`);
	expect(canonical(`${page}/map?unit=page.titles&view=growth`)).toBe(
		`${scope}/pages/page.titles/history`
	);
	expect(canonical(`/harness/commit/${id('e')}/map/unit/service.clock`)).toBe(
		`/harness/commit/${id('e')}/services/service.clock`
	);
});

test('an explorer address is left alone, with its tab', () => {
	expect(canonical('/harness/branch/main/pages')).toBeUndefined();
	expect(
		canonical('/harness/branch/main/functions/function.case?tab=contract&helper=toKebabCase'),
		'legacy callable links lead to readable paths'
	).toBe('/harness/branch/main/helpers/toKebabCase/in/function.case/contract');
	expect(canonical('/harness/branch/main/helpers/toKebabCase/contract')).toBeUndefined();
	expect(
		canonical('/harness/branch/main/helpers/toKebabCase/in/function.case/contract')
	).toBeUndefined();
	expect(
		canonical(`/harness/branch/feature%2Fkept%231/commit/${id('b')}/functions`)
	).toBeUndefined();
	expect(canonical('/harness/branch/main/pages/page.titles/details?tab=source')).toBe(
		'/harness/branch/main/pages/page.titles?tab=source'
	);
	expect(canonical('/harness/branch/main/pages/page.titles/details?tab=nothing')).toBe(
		'/harness/branch/main/pages/page.titles?tab=models'
	);
	expect(canonical('/harness/branch/main/components/component.card/details?tab=nothing')).toBe(
		'/harness/branch/main/components/component.card?tab=contract'
	);
	expect(canonical('/harness/branch/main/pages/page.titles?tab=contract')).toBe(
		'/harness/branch/main/pages/page.titles?tab=models'
	);
	expect(canonical('/harness/branch/main/pages/page.titles?tab=models')).toBeUndefined();
	const page = `/harness/branch/feature%2Fkept%231/commit/${id('b')}/pages/page.titles`;
	for (const [legacy, query] of [
		['/details', '?tab=models'],
		['/details?tab=contract', '?tab=models'],
		['/details?tab=nothing', '?tab=models'],
		['/details?tab=source', '?tab=source'],
		['/details?tab=measurements', ''],
		['?tab=contract', '?tab=models'],
		['?tab=nothing', '']
	]) {
		expect(canonical(page + legacy)).toBe(page + query);
	}
	for (const category of ['components', 'shells', 'functions', 'services', 'configs', 'models']) {
		const path = `/harness/branch/feature%2Fkept%231/commit/${id('b')}/${category}/sample.unit`;
		expect(canonical(`${path}?tab=contract`)).toBeUndefined();
		expect(canonical(`${path}/details?tab=contract`)).toBe(`${path}?tab=contract`);
		expect(canonical(`${path}/details?tab=nothing`)).toBe(`${path}?tab=contract`);
	}
});

test('the report and analytics addresses of the earlier console lead to Pages', () => {
	expect(canonical('/harness/reports')).toBe('/harness/branch/main/pages');
	expect(canonical('/harness/analytics')).toBe('/harness/branch/main/pages');
	expect(canonical('/harness/reports/some-report')).toBe('/harness/branch/main/pages');
});

test('an address that names nothing is left for the page to say so', () => {
	expect(canonical('/harness/branch/main/commit/short/map')).toBeUndefined();
	expect(canonical('/harness/nothing/here')).toBeUndefined();
});
