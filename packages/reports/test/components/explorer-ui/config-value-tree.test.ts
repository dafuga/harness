import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ConfigValueTree from '../../../src/components/explorer-ui/ConfigValueTree.svelte';
import type { ConfigValueNode } from '../../../../../src/utils/explorer-ui/unitMetadata';
import { measureWorkload } from '../../../../../test/support/measureWorkload';

const source = '<orders> & details';
const node: ConfigValueNode = {
	kind: 'object',
	source: '{}',
	count: 2,
	entries: [
		{ name: 'raw_key', node: { kind: 'expression', source } },
		{ name: 'steps', node: { kind: 'array', source: '[]', count: 0, entries: [] } }
	]
};

test('source collections preserve exact keys and escaped expressions with nested disclosures', () =>
	measureWorkload(
		'reports.component.explorer-ui-config-value-tree',
		'render-source-collection',
		() => {
			const body = render(ConfigValueTree, { props: { node } }).body;
			expect(body).toContain('Value contents');
			expect(body).toContain('raw_key');
			expect(body).toContain('&lt;orders> &amp; details');
			expect(body).not.toContain('<orders>');
			expect(body).toContain('steps');
			expect(body).toContain('0 items');
		}
	));
