import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import CodeLine from '../../../src/components/shared-primitives/CodeLine.svelte';
test('clipped and wrapped code retain complete escaped source and a caller-owned inspection action', () => {
	const source = 'const value = "<script>";\n' + 'long_identifier_'.repeat(40);
	const props = { text: source };
	for (const mode of ['clip', 'wrap'] as const) {
		const body = render(CodeLine, { props: { ...props, mode } }).body;
		expect(body).toContain('long_identifier_'.repeat(40));
		expect(body).toContain('&lt;script>');
		expect(body).not.toContain('<script>');
		expect(body).toContain('title=');
	}
	const action = createRawSnippet(() => ({ render: () => '<a href="/source">Open source</a>' }));
	expect(render(CodeLine, { props: { ...props, action } }).body).toContain('href="/source"');
});
