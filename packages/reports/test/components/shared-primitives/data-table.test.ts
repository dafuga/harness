import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import DataTable from '../../../src/components/shared-primitives/DataTable.svelte';
const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));
test('the table names a keyboard-scrollable region and retains header, body and empty semantics', () => {
	const props = {
		label: 'Contract fields',
		header: snippet('<tr><th scope="col">Name</th></tr>'),
		children: snippet('<tr><th scope="row">active</th></tr>'),
		empty: snippet('<tr><td>No fields recorded.</td></tr>')
	};
	const body = render(DataTable, { props }).body;
	expect(body).toMatch(/role="region"[^>]*aria-label="Contract fields"[^>]*tabindex="0"/);
	expect(body).toMatch(/<table[^>]*aria-label="Contract fields"/);
	expect(body).toMatch(/<thead[^>]*>.*<th scope="col">Name/s);
	expect(body).toMatch(/<tbody[^>]*>.*<th scope="row">active/s);
	expect(body).not.toContain('No fields recorded.');
	const empty = render(DataTable, { props: { ...props, isEmpty: true } }).body;
	expect(empty).toContain('No fields recorded.');
	expect(empty).not.toContain('>active<');
});
