import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Provides the SvelteKit document shell', () => {
	const template = readFileSync(new URL('../../src/app.html', import.meta.url), 'utf8');
	const output = {
		doctype: template.includes('<!doctype html>'),
		language: template.includes('<html lang="en">'),
		headPlaceholder: template.includes('%sveltekit.head%'),
		bodyPlaceholder: template.includes('%sveltekit.body%'),
		preloadHover: template.includes('data-sveltekit-preload-data="hover"')
	};

	expect(output).toEqual({
		doctype: true,
		language: true,
		headPlaceholder: true,
		bodyPlaceholder: true,
		preloadHover: true
	});
	recordExampleCases(
		{
			unitId: 'hub.entry.app-html',
			symbol: 'app.html',
			state: 'provides-the-sveltekit-document-shell',
			evidence: 'examples-cases',
			file: 'provides-the-sveltekit-document-shell.json'
		},
		[
			{
				name: 'includes the document shell and SvelteKit insertion points',
				input: { template: 'packages/hub/src/app.html' },
				output
			}
		]
	);
});
