import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import postcss from 'postcss';
import { appStyleTokensConfig } from '../../../src/configs/shared-primitives/appStyleTokensConfig';

/** The actual shared registry, so adding a token requires catalog coverage without a stale count. */
export function declaredStyleTokens(): string[] {
	const root = resolve(import.meta.dirname, '../../../../..');
	const names = new Set<string>();
	postcss
		.parse(readFileSync(resolve(root, appStyleTokensConfig.tokenFile), 'utf8'))
		.walkDecls((declaration) => {
			if (declaration.prop.startsWith('--hx-')) names.add(declaration.prop);
		});
	return [...names].sort();
}

/** Legacy spellings remain valid CSS, but are not choices in the supported Styles catalog. */
const legacyAliases = ['--hx-bg', '--hx-gold', '--hx-muted', '--hx-font-family-sans'];
export function documentedStyleTokens(): string[] {
	return declaredStyleTokens().filter((name) => !legacyAliases.includes(name));
}

/** Shared disclosure headings identify each semantic group and its actual token count. */
export async function expectStyleGroups(scope: Locator): Promise<void> {
	await expect(scope.getByRole('heading', { name: /^Compatibility(?: \d+)?$/ })).toHaveCount(0);
	for (const name of legacyAliases)
		await expect(scope.locator(`[data-style-token="${name}"]`)).toHaveCount(0);
	const declared = documentedStyleTokens();
	for (const group of appStyleTokensConfig.groups) {
		await expect(
			scope.getByRole('region', { name: new RegExp(`^${group} \\d+$`) }),
			'Every Styles group uses its heading underline without an extra top divider'
		).toHaveCSS('border-top-width', '0px');
		const count = declared.filter(
			(name) =>
				appStyleTokensConfig.groups.find((candidate) =>
					appStyleTokensConfig.groupPrefixes[candidate].test(name)
				) === group
		).length;
		await expect(
			scope.getByRole('heading', { level: 2, name: `${group} ${count}`, exact: true })
		).toBeVisible();
	}
}

/** A color inventory must also tell a component author which token fits the intended role. */
export async function expectColorRoles(scope: Locator): Promise<void> {
	const palette = scope.getByRole('region', { name: /^Colors \d+$/ });
	await expect(
		scope.getByRole('region', { name: 'Color roles', exact: true }),
		'Colors combines role guidance and the token inventory'
	).toHaveCount(0);
	await expect(palette, 'Styles has one Colors catalog').toHaveCount(1);
	await expect(palette).toBeVisible();
	const primary = palette.getByRole('article', { name: 'Primary', exact: true });
	const base = primary.getByRole('group', { name: 'Base color', exact: true });
	await expect(base, 'Primary identifies one base color').toBeVisible();
	await expect(base.locator('[data-style-token]')).toHaveCount(1);
	await expect(base.locator('[data-style-token]')).toHaveAttribute(
		'data-style-token',
		'--hx-color-primary'
	);
	const treatments = primary.getByRole('group', { name: 'Treatments', exact: true });
	await expect(treatments, 'Primary variants are subordinate treatments').toBeVisible();
	await expect(treatments.locator('[data-style-token="--hx-color-primary-soft"]')).toHaveCount(1);
	await expect(base.locator('[data-style-token="--hx-color-primary-soft"]')).toHaveCount(0);
	await expect(primary).toContainText(/#[\da-f]{6}|rgb\(/i);
	for (const name of declaredStyleTokens().filter((name) =>
		appStyleTokensConfig.groupPrefixes.Colors.test(name)
	))
		await expect(palette.locator(`[data-style-token="${name}"]`)).toHaveCount(1);
	for (const role of [
		/primary/i,
		/secondary/i,
		/background|surface/i,
		/text/i,
		/success/i,
		/warning/i,
		/error|danger/i
	])
		await expect(palette).toContainText(role);
	await expect(palette).toContainText(/use for/i);
	await expectSemanticRoles(scope, palette);
	const references = (await palette.locator('code').allTextContents()).flatMap((text) =>
		[...text.matchAll(/--hx-[\w-]+/g)].map((match) => match[0])
	);
	expect(references.length, 'Colors names the CSS variables to use').toBeGreaterThan(1);
	const known = new Set(declaredStyleTokens());
	expect(
		references.filter((name) => !known.has(name)),
		'Role variables exist in the app catalog'
	).toEqual([]);
}

/** Roles are actual application properties, rather than headings over palette-named values. */
async function expectSemanticRoles(scope: Locator, palette: Locator): Promise<void> {
	for (const role of [
		'primary',
		'secondary',
		'tertiary',
		'success',
		'warning',
		'error',
		'info',
		'background',
		'surface'
	])
		await expect(palette.locator(`[data-style-token="--hx-color-${role}"]`)).toHaveCount(1);
	for (const name of [
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
		await expect(scope.locator(`[data-style-token="--hx-${name}"]`)).toHaveCount(1);
}

/** Changing an assignment must repaint real consumers, not only the Styles specimen. */
export async function expectRoleAssignments(page: Page): Promise<void> {
	await page.evaluate(() => {
		const root = document.documentElement.style;
		root.setProperty('--hx-color-primary', 'rgb(17, 34, 51)');
		root.setProperty('--hx-font-family-body', 'Georgia, serif');
		root.setProperty('--hx-space-section', '37px');
	});
	try {
		await expect(page.getByRole('link', { name: 'Styles', exact: true })).toHaveCSS(
			'color',
			'rgb(17, 34, 51)'
		);
		await expect(page.locator('.hx-shell').first()).toHaveCSS('font-family', 'Georgia, serif');
		await expect(page.locator('.hx-styles-groups')).toHaveCSS('row-gap', '37px');
	} finally {
		await page.evaluate(() => {
			for (const name of ['--hx-color-primary', '--hx-font-family-body', '--hx-space-section'])
				document.documentElement.style.removeProperty(name);
		});
	}
}
