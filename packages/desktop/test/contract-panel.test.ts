import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import ContractPanel from '../src/components/shared-primitives/ContractPanel.svelte';

test('the default contract explains fields; exact names and types remain in a disclosure', () => {
	const contract = {
		inputs: [
			{
				name: 'searchText',
				type: 'string',
				required: false,
				default: '',
				description: 'Words to find in the page titles.'
			},
			{ name: 'enabled', type: 'boolean', required: false, default: false },
			{ name: 'limit', type: 'number', required: false, default: 0 },
			{ name: 'context', type: 'object', required: true, default: null }
		],
		outputs: [{ name: 'matches', type: 'Page[]', description: 'Pages containing those words.' }],
		errors: [],
		hash: null
	};
	const html = render(ContractPanel, { props: { contract } }).body;
	const visible = html.slice(0, html.indexOf('<details'));
	expect(visible).toContain('Words to find in the page titles.');
	expect(visible).toContain('Pages containing those words.');
	expect(visible).toContain('search text');
	for (const text of ['Required', 'Optional', 'Default', '""', 'false', '0', 'null', 'Page[]'])
		expect(visible).toContain(text);
	expect(html).toContain('Technical contract');
	expect(html).toContain('Page[]');
});

test('missing descriptions and empty contracts are said rather than filled in', () => {
	const contract = {
		inputs: [{ name: 'query', type: 'string' }],
		outputs: [],
		errors: [],
		hash: null
	};
	const html = render(ContractPanel, { props: { contract } }).body;
	expect(html).toContain('No description recorded.');
	expect(html).toContain('Requiredness not recorded');
	expect(html).toContain('No default');
	expect(html).toContain('Nothing declared.');
});
