import { expect, test } from 'vitest';
import { entityBehavior } from '../../../reports/src/utils/entityBehavior';
import RuntimeRun from '../../src/components/RuntimeRun.svelte';
import { commits, drawn, ids, scopeOf, shownEvidence } from '../evidence-fixture';

test('each side lists its states and results; where they differ is said on the after side', async () => {
	const { store } = await shownEvidence(scopeOf(ids.filter, commits.tip));
	const shown = entityBehavior(store.read!);
	const side = (name: 'before' | 'after') =>
		drawn(RuntimeRun, {
			shown,
			side: name,
			title: name === 'before' ? 'Before · bbbbbbb' : 'After · ccccccc',
			role: 'Parent commit',
			lost: false,
			refusals: {}
		});
	const after = side('after');
	expect(after).toContain('role="group" aria-label="After · ccccccc"');
	expect(after).toContain('Search across synthetic orders · match');
	expect(after).toContain('Search across synthetic orders · no-match');
	expect(after).toContain('differs at output[1]');
	expect(after).toContain('aria-label="All results passed"');
	expect(after).toContain('Order 1077 · Service plan');
	const before = side('before');
	expect(before).not.toContain('differs at');
	expect(before).not.toContain('Order 1077 · Service plan');
	expect(before).toContain('Order 1042 · Service call');
});
