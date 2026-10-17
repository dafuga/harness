import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import BrowserErrors from '../../src/components/BrowserErrors.svelte';

test('old and clean records do not invent a logging result', () => {
	expect(render(BrowserErrors, { props: {} }).body).not.toContain('Browser errors');
	expect(render(BrowserErrors, { props: { diagnostics: [] } }).body).not.toContain(
		'Browser errors'
	);
});

test('diagnostic content is text and cannot inject markup into the component viewer', () => {
	const message = '<script>alert("synthetic")</script>';
	const diagnostics = [
		{
			test: 'Escaping',
			file: 'orders.spec.ts',
			project: '',
			retry: 0,
			errors: [{ type: 'console' as const, message, page: '/orders' }],
			expected: []
		}
	];
	const html = render(BrowserErrors, { props: { diagnostics } }).body;
	expect(html).toContain('&lt;script>');
	expect(html).not.toContain('<script>');
	expect(html).toContain('Unexpected');
});
