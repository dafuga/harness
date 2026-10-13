import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityArtifact from '../src/components/harness/EntityArtifact.svelte';
import type { BehaviorCell } from '../src/utils/entityBehavior';
import {
	callRows,
	calls,
	compared,
	elsewhere,
	gaps,
	malformed,
	observed,
	observedRows,
	rows,
	stored,
	unavailable,
	unit,
	words
} from './artifactCaseDocs';

/**
 * A recorded result of a function in the explorer: a row for each input with the output that was
 * observed for it, and a sentence where there is none to show. Nothing is taken from what an
 * assertion compared.
 */
const drawn = (cell: BehaviorCell, scope?: string, lost = false) =>
	render(EntityArtifact, {
		props: { cell, label: 'trace of cases', mediaBase: '/media/', unit: scope, lost }
	}).body.replace(/<!--.*?-->/gs, '');

test('each recorded call of a function is a row: its input, then the output or the error observed', () => {
	const body = drawn(stored(calls), unit);
	expect(rows(body)).toEqual(callRows);
	expect(words(body)).toContain('Calls of composeModes');
	expect(words(body)).not.toMatch(/Actual output|design/i);
});

test('a result that states an input and an output is one row, said to be what a test observed', () => {
	const body = drawn(stored(observed), unit);
	expect(rows(body)).toEqual(observedRows);
	expect(words(body)).toContain('What a test observed end to end');
	expect(words(body)).toContain('Matching order is listed');
	expect(rows(body).flat().join()).not.toMatch(/expected|found|12/);
	expect(words(body)).not.toContain('Actual output');
});

test('what an assertion expected and found is never a row', () => {
	const body = drawn(stored(compared), unit);
	expect(rows(body)).toEqual([]);
	expect(words(body)).toContain(gaps.none);
	expect(words(body)).toContain('Total matches');
	expect(words(body)).not.toContain('Actual output');
});

test('cases that are malformed or of another unit say so and show no row', () => {
	for (const [position, document] of malformed.entries()) {
		const body = drawn(stored(document), unit);
		expect([position, rows(body)]).toEqual([position, []]);
		expect(words(body), String(position)).toContain(gaps.malformed);
	}
	const other = drawn(stored(elsewhere), unit);
	expect(rows(other)).toEqual([]);
	expect(words(other)).toContain(gaps.elsewhere);
});

test('a result that is absent, not stored, unread or not what its hash says shows no row', () => {
	for (const [name, [cell, why]] of Object.entries(unavailable)) {
		const body = drawn(cell, unit);
		expect([name, rows(body)]).toEqual([name, []]);
		expect(words(body), name).toContain(why);
	}
	const lost = drawn(unavailable.unread[0], unit, true);
	expect(words(lost)).toContain('It could not be read and checked against its hash.');
});

test('outside a function a recorded result is drawn as it was', () => {
	const body = drawn(stored(observed));
	expect(rows(body)).toEqual([]);
	expect(words(body)).toContain('Actual output');
	expect(words(body)).toContain('Matching order is listed');
});
