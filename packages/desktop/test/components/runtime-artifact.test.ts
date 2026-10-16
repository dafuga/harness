import { expect, test } from 'vitest';
import { entityBehavior, type BehaviorCell } from '../../../reports/src/utils/entityBehavior';
import { rows, words } from '../../../reports/test/artifactCaseDocs';
import RuntimeArtifact from '../../src/components/RuntimeArtifact.svelte';
import { commits, drawn, ids, refusal, scopeOf, shownEvidence } from '../evidence-fixture';

const label = 'output of match';
const cellOf = async (options = {}) => {
	const { store } = await shownEvidence(scopeOf(ids.filter, commits.tip), options);
	const lines = entityBehavior(store.read!).groups.flatMap((group) => group.lines);
	return { store, cell: lines.find((line) => line.kind === 'output')!.after };
};
const shown = (cell: BehaviorCell, more: { lost?: boolean; refusal?: string } = {}) =>
	drawn(RuntimeArtifact, { cell, label, lost: false, ...more });

test('a read and checked result shows what it was asked, what it answered and what held', async () => {
	const { cell } = await cellOf();
	const body = shown(cell);
	expect(body).toContain('role="group" aria-label="output of match"');
	for (const heading of ['Steps', 'Assertions']) expect(body).toContain(`<h5>${heading}</h5>`);
	// What it was asked and what it answered are one row of the shared table, under no heading.
	expect(rows(body)).toEqual([
		['Case', 'Input', 'Observedoutput'],
		[
			'Testobservation',
			'SearchtextTextSERVICE',
			'TextOrder1042·ServicecallTextOrder1077·Serviceplan'
		]
	]);
	expect(body).not.toMatch(/<h5>Input<\/h5>|Actual output/);
	expect(words(body)).toContain('Search text Text SERVICE');
	expect(body).toContain('Order 1077 · Service plan');
	expect(body).toContain('Matching order is listed');
	expect(body).toContain('aria-label="Held"');
	expect(body).not.toMatch(/<a |href=/);
});

test('a result that was not read says why, in the words of the backend when it refused', async () => {
	const { cell } = await cellOf();
	const damaged = await cellOf({ corrupt: [cell.capture!.sha256] });
	const unverified = shown(damaged.cell);
	expect(unverified).toContain('The bytes that were read do not have the recorded SHA-256.');
	expect(unverified).not.toContain('Order 1077');
	const refused = await cellOf({ refuse: [cell.capture!.sha256] });
	expect(shown(refused.cell, { refusal })).toContain(refusal);
	const unread: BehaviorCell = { outcome: 'passed', capture: cell.capture };
	expect(shown(unread)).toContain('Reading what it holds…');
	expect(shown(unread, { lost: true })).toContain('It could not be read and checked');
});

test('what was not recorded or is not stored is said, and nothing stands in for it', async () => {
	const { cell } = await cellOf();
	expect(shown({ outcome: 'missing', capture: null })).toContain('Not recorded');
	const lost = { ...cell.capture!, media: null, gap: 'the bytes are not in this history' };
	const body = shown({ outcome: 'passed', capture: lost });
	expect(body).toContain('aria-label="Not stored"');
	expect(body).toContain('the bytes are not in this history');
});
