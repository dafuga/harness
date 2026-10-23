import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { appStyleTokensConfig as config } from '../../../src/config/shared-primitives/appStyleTokensConfig';
import { styleTokenViolations } from './styleTokenAudit';

const root = resolve(import.meta.dirname, '../../../../..');
function sources(directory: string): string[] {
	return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) return sources(path);
		return /\.(?:css|svelte)$/.test(path) ? [path] : [];
	});
}

test.each([
	['color: #fff', true],
	['color: var(--hx-text)', false],
	['color: var(--hx-text, #fff)', true],
	['color: currentColor', false],
	['padding: 12px', true],
	['padding: 0 var(--hx-space-3)', false],
	['font-size: 0.875rem', true],
	['font: inherit', false],
	['font-family: monospace', true],
	['font-weight: 600', true],
	['box-shadow: 0 4px 8px black', true],
	['opacity: .5', true],
	['background: color-mix(in srgb, var(--hx-gold) 20%, transparent)', false]
])('style admission characterizes %s', (declaration, fails) => {
	expect(styleTokenViolations(`.fixture {${declaration}}`, 'fixture.css').length > 0).toBe(fails);
});

test('literal style directives and SVG paints use the same admission rule', () => {
	expect(styleTokenViolations('<span style:color="#fff"></span>', 'fixture.svelte')).toHaveLength(
		1
	);
	expect(styleTokenViolations('<svg><path fill="#fff" /></svg>', 'fixture.svelte')).toHaveLength(1);
});

test('literal inline component colors use the same admission rule', () => {
	expect(
		styleTokenViolations('<span style="background:#fff"></span>', 'fixture.svelte')
	).toHaveLength(1);
});

test('all Harness component design values use the shared token catalog', () => {
	const violations = config.roots
		.flatMap(sources)
		.flatMap((path) => styleTokenViolations(readFileSync(join(root, path), 'utf8'), path));
	expect(violations, 'Undocumented design values remain outside the shared token catalog').toEqual(
		[]
	);
});
