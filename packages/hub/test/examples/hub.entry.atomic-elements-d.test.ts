import { test } from 'vitest';
import type {} from '../../src/lib/atoms/native-elements';
import type { SvelteHTMLElements } from 'svelte/elements';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Declares atomic HTML element aliases', () => {
	const tags: Array<keyof SvelteHTMLElements> = ['hx-button', 'hx-input-email'];
	expect(tags).toEqual(['hx-button', 'hx-input-email']);
	recordExampleCases(
		{
			unitId: 'hub.entry.atomic-elements-d',
			symbol: 'SvelteHTMLElements',
			state: 'declares-atomic-html-element-aliases',
			evidence: 'examples-cases',
			file: 'declares-atomic-html-element-aliases.json'
		},
		tags.map((tag) => ({
			name: `declares ${tag}`,
			input: tag,
			output: { tag }
		}))
	);
});
