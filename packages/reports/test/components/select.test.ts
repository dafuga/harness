import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import Select from '../../src/components/Select.svelte';

const option = createRawSnippet(() => ({
	render: () => '<option value="tablet">920px tablet</option>'
}));
const markup = (props: Record<string, unknown> = {}) =>
	render(Select, { props: { label: 'Viewport', children: option, ...props } }).body;
/** The opening tag of the one native field the component renders. */
const field = (body: string) => body.match(/<select\b[^>]*>/g) ?? [];

test('the shared select names its field, carries its form name and holds the options it is given', () => {
	const body = markup({ name: 'viewport' });
	const [tag, ...more] = field(body);
	expect(more).toEqual([]);
	expect(tag).toContain('aria-label="Viewport"');
	expect(tag).toContain('name="viewport"');
	expect(tag).not.toContain('disabled');
	// The options are the field's own children, and the caret beside it is not read out.
	expect(body).toMatch(
		/<select\b[^>]*>.*<option value="tablet">920px tablet<\/option>.*<\/select>/s
	);
	expect(body).toMatch(/<\/select>\s*<svg\b[^>]*aria-hidden="true"/);
	expect(field(markup())[0]).not.toContain('name=');
	const compact = markup({ compact: true, display: 'feature/very-long-branch-name' });
	expect(compact).toContain('featur…h-name');
	expect(field(compact)[0]).toContain('title="feature/very-long-branch-name"');
});

test('a disabled select is disabled as a field and dimmed together with its caret', () => {
	const body = markup({ disabled: true });
	expect(field(body)[0]).toMatch(/\sdisabled\b/);
	expect(body).toMatch(/class="report-select[^"]*\bdisabled\b/);
	expect(markup()).not.toMatch(/class="report-select[^"]*\bdisabled\b/);
});

test('a required select with an id of its own says both on the field a label and a form reach', () => {
	const [tag] = field(markup({ id: 'upload-viewport', required: true }));
	expect(tag).toContain('id="upload-viewport"');
	expect(tag).toMatch(/\srequired\b/);
	// Neither is made up for a field that was given none.
	const [plain] = field(markup());
	expect(plain).not.toContain('id=');
	expect(plain).not.toContain('required');
});

test('a label may hold the select: it is made of phrasing content only', () => {
	expect(markup({ name: 'viewport', disabled: true })).not.toMatch(/<(div|p|section)\b/);
});
