import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import RecordedValue from '../../src/components/RecordedValue.svelte';

const draw = (value: unknown) => render(RecordedValue, { props: { value } }).body;

test('people read named fields and typed values rather than a JSON document', () => {
	const html = draw({ searchText: 'SERVICE', active: false, count: 0, result: null });
	expect(html).toContain('Search text');
	expect(html).toContain('SERVICE');
	expect(html).toContain('Boolean');
	expect(html).toContain('false');
	expect(html).toContain('Number');
	expect(html).toContain('0');
	expect(html).toContain('Null');
	expect(html).not.toContain('<pre');
});

test('returned records form a labelled table; errors and markup remain text', () => {
	const html = draw([
		{ id: 'app', distance: 1 },
		{ id: 'old', distance: 0 }
	]);
	expect(html).toContain('<table');
	expect(html).toContain('Distance');
	expect(html).toContain('app');
	expect(html).toContain('old');
	expect(draw({ error: '<script>alert(1)</script>' })).not.toContain('<script>');
});

test('empty, absent and falsy values are different to a reader', () => {
	const cases = [
		[undefined, 'Not recorded'],
		[[], 'Empty list'],
		[{}, 'Empty object'],
		['', 'Empty text'],
		[null, 'Null']
	] as const;
	for (const [value, label] of cases) expect(draw(value)).toContain(label);
	expect(draw('false')).toContain('Text');
	expect(draw(false)).toContain('Boolean');
	expect(draw('')).not.toBe(draw('Empty text'));
});
