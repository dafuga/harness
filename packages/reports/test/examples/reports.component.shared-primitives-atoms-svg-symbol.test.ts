import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { test } from 'vitest';
import SvgSymbol from '../../src/components/shared-primitives/atoms/SvgSymbol.svelte';

test('renders children inside the native symbol element', () => {
	const childMarkup = '<path d="M2 2h12v12H2z" />';
	const props = {
		id: 'status-ready',
		viewBox: '0 0 16 16',
		children: createRawSnippet(() => ({ render: () => childMarkup }))
	};
	const body = render(SvgSymbol, { props }).body.trim();
	const symbolMarkup = body.match(/<symbol\b[\s\S]*?<\/symbol>/)?.[0] ?? '';
	expect(symbolMarkup).toMatch(/^<symbol\b/);
	expect(symbolMarkup).toContain('id="status-ready"');
	expect(symbolMarkup).toContain('viewBox="0 0 16 16"');
	expect(symbolMarkup).toContain(childMarkup);
	expect(symbolMarkup).not.toMatch(/<(?:div|span)\b/);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-symbol',
			symbol: 'SvgSymbol',
			state: 'renders-children-inside-the-native-symbol-element',
			evidence: 'examples-cases',
			file: 'renders-children-inside-the-native-symbol-element.json'
		},
		[
			{
				name: 'renders a named symbol with its child path',
				input: { id: props.id, viewBox: props.viewBox, children: childMarkup },
				output: { body: symbolMarkup }
			}
		]
	);
});
