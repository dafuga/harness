import { expect, test } from 'vitest';
import { entityScreens, screenOptions, screenPick } from '../../../reports/src/utils/entityScreens';
import RuntimePane from '../../src/components/RuntimePane.svelte';
import { commits, drawn, ids, scopeOf, shownEvidence } from '../evidence-fixture';

test('a side without a capture says so in the words of the record, and shows no image', async () => {
	const { store, result } = await shownEvidence(scopeOf(ids.page, commits.tip));
	const options = screenOptions(result.evidence.scenarios);
	const pick = screenPick(options, { state: 'empty' });
	const { before, after } = entityScreens(result.evidence, pick);
	const gap = drawn(RuntimePane, {
		item: before!,
		title: 'Before · bbbbbbb',
		role: 'Parent commit',
		evidence: store
	});
	expect(gap).toContain('aria-label="Before · bbbbbbb"');
	expect(gap).toContain('aria-label="No capture"');
	expect(gap).toContain('No capture of empty at desktop is recorded for bbbbbbb.');
	expect(gap).not.toContain('<img');
	// Nothing is shown of a capture before its bytes were read and checked.
	const unread = drawn(RuntimePane, {
		item: after,
		title: 'After · ccccccc',
		role: 'Selected commit',
		evidence: store
	});
	expect(unread).toContain('Reading the capture…');
	expect(unread).not.toContain('<img');
});
