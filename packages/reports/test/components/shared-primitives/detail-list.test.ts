import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import DetailList from '../../../src/components/shared-primitives/DetailList.svelte';
test('definition rows preserve caller-owned falsy values, repeated labels and explicit empty content', () => {
	const rows = [false, 0, ''];
	const label = createRawSnippet(() => ({ render: () => '<span>Value</span>' }));
	const children = createRawSnippet<[unknown]>((row) => ({
		render: () => `<span>${row() === '' ? 'Empty string' : String(row())}</span>`
	}));
	const props = { rows, rowKey: (_row: unknown, position: number) => position, label, children };
	const body = render(DetailList, { props }).body;
	expect((body.match(/<dt\b/g) ?? []).length).toBe(3);
	expect((body.match(/<dd\b/g) ?? []).length).toBe(3);
	for (const value of ['false', '0', 'Empty string']) expect(body).toContain(`>${value}<`);
	const empty = createRawSnippet(() => ({ render: () => '<p>No details provided.</p>' }));
	const blank = render(DetailList, { props: { ...props, rows: [], empty } }).body;
	expect(blank).toContain('No details provided.');
	expect(blank).not.toContain('<dl');
});
