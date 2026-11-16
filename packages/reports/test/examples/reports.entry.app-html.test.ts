import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const templatePath = fileURLToPath(new URL('../../src/app.html', import.meta.url));
const expectedTokens = ['%sveltekit.assets%', '%sveltekit.head%', '%sveltekit.body%'];

function readTemplate(): string {
	return readFileSync(templatePath, 'utf8');
}

test('Holds the SvelteKit head, body and asset placeholders', () => {
	const template = readTemplate();
	const tokens = template.match(/%sveltekit\.\w+%/g) ?? [];
	const hasDoctype = /^<!doctype html>/i.test(template);
	const bodyPreload = template.match(/data-sveltekit-preload-data="(\w+)"/)?.[1] ?? null;

	expect(tokens).toEqual(expectedTokens);
	expect(hasDoctype).toBe(true);
	expect(bodyPreload).toBe('hover');

	recordExampleCases(
		{
			unitId: 'reports.entry.app-html',
			symbol: 'app.html',
			state: 'holds-the-sveltekit-head-body-and-asset-placeholders',
			evidence: 'examples-cases',
			file: 'holds-the-sveltekit-head-body-and-asset-placeholders.json'
		},
		[
			{
				name: 'lists the placeholders in render order',
				input: { template: 'src/app.html' },
				output: { placeholders: tokens }
			},
			{
				name: 'declares an html5 document with a hover preload body',
				input: { template: 'src/app.html' },
				output: { doctype: hasDoctype, bodyPreload }
			}
		]
	);
});
