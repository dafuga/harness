import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import EntityArtifact from '../src/components/explorer-ui/EntityArtifact.svelte';
import { observed, observedRows, rows, stored, unavailable, words } from './artifactCaseDocs';

const draw = (document: unknown) =>
	render(EntityArtifact, {
		props: { cell: stored(document), label: 'test result', mediaBase: '/media/' }
	}).body;

test('a nonfunction test shows its recorded input beside its observed output', () => {
	const body = draw(observed);
	expect(rows(body)).toEqual(observedRows);
	expect(words(body)).not.toContain('Actual output');
	expect(words(body)).not.toContain('this function');
	expect(words(body)).toContain('Matching order is listed');
});

test('zero, false and null are recorded test values, not missing evidence', () => {
	const examples = [
		[0, 'Number0'],
		[false, 'Booleanfalse'],
		[null, 'Nullnull'],
		[[], 'Emptylist']
	] as const;
	for (const [output, shown] of examples) {
		const body = draw({ input: { request: 'example' }, output });
		expect(rows(body)[1]?.[2]).toBe(shown);
	}
});

test('assertion comparisons and a lone input do not become observed output', () => {
	for (const document of [{ input: 1 }, { actual: 2, expected: 2 }]) {
		const body = draw(document);
		expect(rows(body)).toEqual([]);
		expect(words(body)).toContain('This result records no input and output.');
	}
});

test('unverified bytes never produce test case rows', () => {
	for (const [cell] of Object.values(unavailable)) {
		const body = render(EntityArtifact, {
			props: { cell, label: 'test result', mediaBase: '/media/' }
		}).body;
		expect(rows(body)).toEqual([]);
	}
});
