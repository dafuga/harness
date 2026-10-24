import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import ExplorerLayout from '../../../src/components/explorer-ui/ExplorerLayout.svelte';

const children = createRawSnippet(() => ({
	render: () => '<section aria-label="Child content">A page</section>'
}));

test('the layout puts shared navigation above its supplied child and keeps notices', () => {
	const body = render(ExplorerLayout, {
		props: {
			base: '/harness',
			problem: 'The selected revision is unavailable.',
			missing: null,
			navbar: {
				repository: 'Example project',
				scope: null,
				index: null,
				commits: [],
				href: () => '/harness',
				onroute: () => {}
			},
			children
		}
	}).body;
	expect(body).toContain('data-harness-component="explorer-ui-explorer-layout"');
	expect(body).toContain('The selected revision is unavailable.');
	expect(body).toContain('aria-label="Child content"');
	expect(body.indexOf('Example project')).toBeLessThan(body.indexOf('A page'));
	expect(body.match(/A page/g)).toHaveLength(1);
});
