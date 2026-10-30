import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityCases from '../../src/components/explorer-ui/entity-cases/EntityCases.svelte';
import {
	callRows,
	calls,
	compared,
	gaps,
	observed,
	observedRows,
	rows,
	unit,
	words
} from '../artifactCaseDocs';

const drawn = (document: unknown, scope?: string) =>
	render(EntityCases, { props: { document, unit: scope } }).body.replace(/<!--.*?-->/gs, '');

test('document access errors propagate while reading cases', () => {
	const error = new Error('document unavailable');
	const document = Object.defineProperty({}, 'kind', {
		get: () => {
			throw error;
		}
	});
	expect(() => drawn(document)).toThrow(error);
});

test('cases are a table of input and observed output, with where they come from', () => {
	expect(rows(drawn(calls, unit))).toEqual(callRows);
	expect(words(drawn(calls, unit))).toContain('Calls of composeModes recorded by a test.');
	expect(rows(drawn(observed, unit))).toEqual(observedRows);
	expect(words(drawn(observed))).toContain('it is not a direct call of this function');
});

test('a result without cases is one sentence and no table', () => {
	const body = drawn(compared, unit);
	expect(body).not.toContain('<table');
	expect(words(body)).toBe(gaps.none);
});
