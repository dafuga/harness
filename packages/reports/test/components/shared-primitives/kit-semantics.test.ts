import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import Pill from '../../../src/components/explorer-ui/explorer-kit/Pill.svelte';
import Notice from '../../../src/components/explorer-ui/explorer-kit/Notice.svelte';
import EmptyState from '../../../src/components/explorer-ui/explorer-kit/EmptyState.svelte';
const children = createRawSnippet(() => ({ render: () => '<span>Invoice approval</span>' }));
test('Kit primitives retain native semantics, owner classes and accessible names', () => {
	const pill = render(Pill, {
		props: {
			children,
			as: 'li',
			variant: 'chip',
			tone: 'gold',
			state: 'recorded',
			role: 'img',
			label: 'Recorded invoice',
			title: 'Invoice A-1048'
		}
	}).body;
	expect(pill).toMatch(/<li[^>]*class="chip gold"/);
	expect(pill).toContain('data-state="recorded"');
	expect(pill).toContain('aria-label="Recorded invoice"');
	expect(pill).toContain('title="Invoice A-1048"');
	const compact = render(Pill, { props: { children, variant: 'compact' } }).body;
	expect(compact).toMatch(/<span[^>]*class="pill"/);
	for (const component of [Notice, EmptyState]) {
		const body = render(component, {
			props: {
				children,
				as: 'div',
				className: 'run-message',
				role: 'status',
				id: 'invoice-message',
				label: 'Review status',
				component: 'invoice-review'
			}
		}).body;
		expect(body).toMatch(/<div[^>]*class="run-message(?:\s|")/);
		expect(body).toContain('role="status"');
		expect(body).toContain('data-harness-component="invoice-review"');
		expect(body).toContain('Invoice approval');
	}
});
