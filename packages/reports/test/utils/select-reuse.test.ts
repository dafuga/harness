import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const source = join(import.meta.dirname, '../../src');
const shared: string = JSON.parse(
	readFileSync(join(source, '../../../specification/units/reports.component.select.json'), 'utf8')
).runtime.entry.replace('packages/reports/src/', '');
const sources = (readdirSync(source, { recursive: true }) as string[])
	.filter((name) => /\.(svelte|ts|html)$/.test(name))
	.map((name) => name.replaceAll('\\', '/'))
	.sort();
const holding = (pattern: RegExp) =>
	sources.filter((file) => pattern.test(readFileSync(join(source, file), 'utf8')));

test('a select field is written once, in the shared component, and nowhere beside it', () => {
	// A field written by hand has no caret, its own size and its own colours, and drifts from
	// the others; every choice on the website is the shared component with its options inside.
	expect(holding(/<select[\s>]/)).toEqual([]);
	expect(holding(/<hx-select[\s>]/)).toEqual([shared]);
	expect(holding(/createElement\(\s*['"]select['"]/)).toEqual([]);
	expect(holding(/<Select[\s>]/).length).toBeGreaterThan(1);
});
