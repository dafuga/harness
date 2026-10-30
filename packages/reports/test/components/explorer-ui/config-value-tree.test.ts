import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ConfigValueTree, {
	collection,
	valueMark
} from '../../../src/components/explorer-ui/ConfigValueTree.svelte';
import type { ConfigValueMark } from '../../../src/components/explorer-ui/ConfigValueTree.svelte';
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

test('inspection marks expose their icon and source-size label', () => {
	const mark: ConfigValueMark | undefined = valueMark(node, node.source);
	expect(mark).toEqual({ icon: 'object', size: '2 attributes' });
});

test('errors from caller-provided source node access propagate', () => {
	const error = new Error('source node unavailable');
	const source = new Proxy(node, {
		get: () => {
			throw error;
		}
	});
	expect(() => collection(source)).toThrow(error);
	expect(() => valueMark(source, '{}')).toThrow(error);
	expect(() => render(ConfigValueTree, { props: { node: source } }).body).toThrow(error);
});
