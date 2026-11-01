import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ComparePanes from '../../../src/components/shared-primitives/ComparePanes.svelte';
import { comparisonPanes } from '../../../src/helpers/verification-evidence/comparisonPanes';
import type { ComparisonPane } from '../../../src/helpers/verification-evidence/comparisonPanes.types';

const content = createRawSnippet<[ComparisonPane<unknown>]>((pane) => ({
	render: () => `<p>${pane().value}</p>`
}));
test('comparison labels and metadata come from the same side in every view', () => {
	const panes = comparisonPanes(
		{ commit: 'a12bc34def', value: 'Build: orders-parent' },
		{ commit: 'b56de78abc', value: 'Build: orders-selected' }
	);
	for (const side of ['before', 'after'] as const) {
		const body = render(ComparePanes, { props: { panes, visible: side, children: content } }).body;
		const own =
			side === 'before'
				? ['Before · a12bc34', 'Build: orders-parent']
				: ['After · b56de78', 'Build: orders-selected'];
		const other = side === 'before' ? 'Build: orders-selected' : 'Build: orders-parent';
		for (const text of own) expect(body).toContain(text);
		expect(body).not.toContain(other);
	}
	const gap = render(ComparePanes, {
		props: {
			panes: comparisonPanes(null, { commit: 'b56de78abc', gap: 'No selected capture.' }),
			children: content
		}
	}).body;
	expect(gap).toContain('No selected capture.');
	expect(gap).not.toContain('Build: orders-parent');
});
