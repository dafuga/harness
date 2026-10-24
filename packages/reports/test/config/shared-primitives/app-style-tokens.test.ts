import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import postcss from 'postcss';
import { appStyleTokensConfig as config } from '../../../src/configs/shared-primitives/appStyleTokensConfig';
import { responsiveThresholds, styleTokenViolations } from './styleTokenAudit';

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
	['scrollbar-color: #123456 transparent', true],
	['accent-color: var(--gold, #f3c33b)', true],
	['backdrop-filter: blur(3px)', true],
	['filter: brightness(0.95)', true],
	['filter: var(--hx-effect-hover-dim)', false],
	['animation: spinner var(--hx-motion-spin) linear infinite', true],
	['--hx-style-weight-bold: 900', true],
	['--hx-nav-gap: var(--hx-space-3)', false],
	['color: RebeccaPurple', true],
	['border: var(--hx-border-thin) solid rebeccapurple', true],
	['fill: url(#c0ffee)', false],
	['color: var(--hx-text)', false],
	['color: var(--hx-text, #fff)', true],
	['color: currentColor', false],
	['padding: 12px', true],
	['padding: 0 var(--hx-space-3)', false],
	['font-size: 0.875rem', true],
	['font: inherit', false],
	['font-family: monospace', true],
	['font-weight: 600', true],
	['font-weight: var(--hx-style-weight-semibold)', false],
	['border: 1px solid var(--hx-line)', true],
	['border-radius: 50%', true],
	['transition: color .15s ease', true],
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

/** A component cannot invent a private hx token that the Styles registry never documents. */
test('all public app token references are declared in the canonical catalog', () => {
	const declared = new Set<string>();
	postcss.parse(readFileSync(join(root, config.tokenFile), 'utf8')).walkDecls((declaration) => {
		if (declaration.prop.startsWith('--hx-')) declared.add(declaration.prop);
	});
	const unknown = config.roots.flatMap(sources).flatMap((path) => {
		const source = readFileSync(join(root, path), 'utf8');
		return [...source.matchAll(/var\(\s*(--hx-[\w-]+)/g)]
			.filter((match) => !declared.has(match[1]))
			.map((match) => `${path}: ${match[1]}`);
	});
	expect([...new Set(unknown)], 'Every public app token must be documented').toEqual([]);
});

test('every responsive media and container threshold is documented in Styles', () => {
	const declared = [
		...readFileSync(join(root, config.tokenFile), 'utf8').matchAll(
			/--hx-breakpoint-[\w-]+:\s*(\d+)px/g
		)
	].map((match) => Number(match[1]));
	const missing = config.roots.flatMap(sources).flatMap((path) =>
		responsiveThresholds(readFileSync(join(root, path), 'utf8'), path)
			.filter((width) => !declared.some((known) => Math.abs(width - known) <= 1))
			.map((width) => `${path}: ${width}px`)
	);
	expect(missing).toEqual([]);
});

test('shared style roles are real canonical properties consumed by every application', () => {
	const css = readFileSync(join(root, config.tokenFile), 'utf8');
	const declared = new Set<string>();
	postcss.parse(css).walkDecls((declaration) => {
		declared.add(declaration.prop);
	});
	for (const role of [
		'color-primary',
		'color-secondary',
		'color-tertiary',
		'color-success',
		'color-warning',
		'color-error',
		'color-info',
		'color-background',
		'color-surface',
		'font-family-body',
		'font-family-heading',
		'font-family-code',
		'type-size-body',
		'type-size-heading',
		'type-size-caption',
		'space-section',
		'space-control',
		'space-inline',
		'radius-control',
		'radius-panel'
	])
		expect(declared.has(`--hx-${role}`), `Canonical assignment for ${role}`).toBe(true);
	for (const directory of config.roots) {
		let consumers = sources(directory)
			.filter((path) => path !== config.tokenFile)
			.map((path) => readFileSync(join(root, path), 'utf8'))
			.join('\n');
		// Hub's real root layout imports the shared Desktop workspace stylesheet.
		if (consumers.includes("import '$desktop/lib/styles/workspace.css'"))
			consumers += readFileSync(
				join(root, 'packages/desktop/src/lib/styles/workspace-0.css'),
				'utf8'
			);
		expect(consumers, `${directory} uses the primary role`).toContain('var(--hx-color-primary)');
		expect(consumers, `${directory} uses body typography`).toContain('var(--hx-font-family-body)');
	}
});
