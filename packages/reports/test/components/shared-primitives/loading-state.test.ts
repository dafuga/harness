import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import LoadingState from '../../../src/components/shared-primitives/LoadingState.svelte';

test('loading state exposes a readable status and hides its decorative indicator', () => {
	const { body } = render(LoadingState);
	expect(body).toContain('role="status"');
	expect(body).toContain('aria-live="polite"');
	expect(body).toContain('aria-atomic="true"');
	expect(body).toContain('aria-hidden="true"');
	expect(body).toContain('Loading…');
});

test('loading state labels remain escaped plain text', () => {
	const { body } = render(LoadingState, { props: { label: 'Loading <page> data…' } });
	expect(body).toContain('Loading &lt;page> data…');
	expect(body).not.toContain('<page>');
});
