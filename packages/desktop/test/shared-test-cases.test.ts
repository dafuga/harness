import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import RuntimeArtifact from '../src/components/RuntimeArtifact.svelte';
import {
	observed,
	observedRows,
	rows,
	stored,
	unavailable,
	words
} from '../../reports/test/artifactCaseDocs';
import { drawn } from './evidence-fixture';

test('a component or service test shares the recorded input and output table', () => {
	const body = drawn(RuntimeArtifact, {
		cell: stored(observed),
		label: 'test result',
		lost: false
	});
	expect(rows(body)).toEqual(observedRows);
	expect(words(body)).not.toContain('Actual output');
	expect(words(body)).not.toContain('this function');
	expect(words(body)).toContain('Matching order is listed');
});

test('test rows remain unavailable when their artifact was not read and verified', () => {
	for (const [cell] of Object.values(unavailable)) {
		const body = drawn(RuntimeArtifact, { cell, label: 'test result', lost: false });
		expect(rows(body)).toEqual([]);
	}
});
