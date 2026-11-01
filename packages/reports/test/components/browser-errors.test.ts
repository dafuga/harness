import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import BrowserErrors from '../../src/components/shared-primitives/browser-errors/BrowserErrors.svelte';

test('old and clean records do not invent a logging result', () => {
	const unavailable = render(BrowserErrors, { props: {} }).body;
	const empty = render(BrowserErrors, { props: { diagnostics: [] } }).body;
	expect(unavailable).toContain('Browser diagnostics are unavailable for this record.');
	expect(empty).toContain('No browser diagnostic entries were recorded.');
	const attempt = render(BrowserErrors, {
		props: {
			diagnostics: [
				{
					test: 'Checkout decline',
					file: 'checkout.spec.ts',
					project: 'Chromium',
					retry: 0,
					errors: [],
					expected: []
				}
			]
		}
	}).body;
	expect(attempt).toContain('No diagnostic entries were recorded for this test.');
	expect(unavailable).not.toContain('Browser errors');
	expect(empty).not.toContain('Browser errors');
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
	expect(html).toContain('1 entry');
});
