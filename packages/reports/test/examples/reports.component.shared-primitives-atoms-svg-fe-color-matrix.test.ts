import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgFeColorMatrix from '../../src/components/shared-primitives/atoms/SvgFeColorMatrix.svelte';

const location = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-color-matrix',
	symbol: 'SvgFeColorMatrix',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const relevantMarkup = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '').trim();

test('omitted children render only the native element', () => {
	const props = { values: '0 1 0 0 0', result: 'colored' };
	const body = relevantMarkup(render(SvgFeColorMatrix, { props }).body);
	expect(body).toMatch(
		/^<feColorMatrix[^>]*values="0 1 0 0 0"[^>]*result="colored"[^>]*><\/feColorMatrix>$/
	);
	expect(body).not.toContain('div');
	recordExampleCases(location('omitted-children-render-only-the-native-element'), [
		{
			name: 'attributes render on the native element without child content',
			input: { props },
			output: { body }
		}
	]);
});

test('supplied snippet renders inside the native element', () => {
	const child = '<feFuncR type="identity"></feFuncR>';
	const props = { type: 'matrix', children: createRawSnippet(() => ({ render: () => child })) };
	const body = relevantMarkup(render(SvgFeColorMatrix, { props }).body);
	expect(body).toContain('<feFuncR type="identity"></feFuncR>');
	expect(body).toMatch(/^<feColorMatrix[^>]*type="matrix"[^>]*>.*<\/feColorMatrix>$/);
	expect(body).not.toContain('<div');
	recordExampleCases(location('supplied-snippet-renders-inside-the-native-element'), [
		{
			name: 'the child snippet remains inside the native feColorMatrix element',
			input: { props: { type: 'matrix' }, childSnippet: child },
			output: { body }
		}
	]);
});
