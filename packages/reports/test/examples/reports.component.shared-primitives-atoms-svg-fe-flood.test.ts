import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeFlood from '../../src/components/shared-primitives/atoms/SvgFeFlood.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeFlood component, rendered on the server with `render` from 'svelte/server' and
 * example props. The markup is the native feFlood element: forwarded attributes are applied to it
 * directly, and no wrapper element is added around it.
 */
/** The server render wraps the element in hydration comments; they carry no markup, so they are dropped. */
const markup = (body: string): string => body.replace(/<!--.*?-->/g, '');

const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-flood',
	symbol: 'SvgFeFlood',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('renders the bare feFlood element with its attributes', () => {
	const props = {
		id: 'flood-fill',
		result: 'flood',
		'flood-color': 'rgb(0, 128, 255)',
		'flood-opacity': '0.5'
	};
	const body = markup(render(SvgFeFlood, { props }).body);
	recordExampleCases(where('renders-the-bare-feflood-element-with-its-attributes'), [
		{
			name: 'an feFlood with an id, a result name, a colour and an opacity, and no children',
			input: { props },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feFlood[^>]*>/);
	expect(body).toMatch(/<feFlood[^>]*id="flood-fill"/);
	expect(body).toMatch(/<feFlood[^>]*result="flood"/);
	expect(body).toMatch(/<feFlood[^>]*flood-color="rgb\(0, 128, 255\)"/);
	expect(body).toMatch(/<feFlood[^>]*flood-opacity="0\.5"/);
	expect(body).toMatch(/<\/feFlood>$/);
	expect(body).not.toMatch(/<(svg|g|div|span)[\s>]/);
});

test('renders a child snippet inside the feFlood element', () => {
	const children = createRawSnippet(() => ({ render: () => '<desc>Solid flood</desc>' }));
	const body = markup(render(SvgFeFlood, { props: { id: 'flood-described', children } }).body);
	recordExampleCases(where('renders-a-child-snippet-inside-the-feflood-element'), [
		{
			name: 'an feFlood with an id and a snippet supplying one desc child',
			input: {
				props: { id: 'flood-described' },
				children: 'snippet rendering <desc>Solid flood</desc>'
			},
			output: { body }
		}
	]);
	expect(body).toMatch(
		/^<feFlood[^>]*id="flood-described"[^>]*><desc>Solid flood<\/desc><\/feFlood>$/
	);
	expect(body).not.toContain('children');
});
