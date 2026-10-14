import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import BrandMark from '../../src/components/BrandMark.svelte';

/**
 * One shared mark, drawn in the colour of its text and hidden from assistive technology beside
 * the word Harness. Every brand surface of every app compiles to that component, never to the
 * old diamond glyph or chevron mark.
 */
const packages = resolve(import.meta.dirname, '../../..');
const surfaces = [
	'desktop/src/components/NavBar.svelte',
	'desktop/src/components/ProjectGate.svelte',
	'hub/src/components/HubFrame.svelte',
	'reports/src/components/harness/HarnessNavbar.svelte',
	'reports/src/components/harness/HarnessHeader.svelte',
	'reports/src/components/HubView.svelte',
	'reports/src/components/ReportView.svelte'
];

test('the mark is five square tiles in the current colour, decorative by default', () => {
	const body = render(BrandMark, { props: {} }).body;
	expect(body).toMatch(/<svg[^>]*data-brand-mark="modular-h"/);
	expect(body).toMatch(/<svg[^>]*aria-hidden="true"/);
	expect(body).toMatch(/<svg[^>]*fill="currentColor"/);
	const tiles = [...body.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)];
	expect(tiles).toHaveLength(5);
	expect(new Set(tiles.map(([, , , width, height]) => `${width}x${height}`)).size).toBe(1);
	expect(body).not.toContain('◈');
});

test('a labelled mark is an image with that name', () => {
	const body = render(BrandMark, { props: { label: 'Harness' } }).body;
	expect(body).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Harness"/);
	expect(body).not.toContain('aria-hidden');
});

test.each(surfaces)('%s compiles to the shared mark, not the old one', (path) => {
	const source = readFileSync(resolve(packages, path), 'utf8');
	const output = compile(source, { generate: 'server', filename: path }).js.code;
	expect(output).toMatch(/BrandMark/);
	expect(output).not.toContain('◈');
	expect(output).not.toContain('M17 29 30 16 17 3');
});
