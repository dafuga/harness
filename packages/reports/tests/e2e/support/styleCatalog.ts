import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Locator } from '@playwright/test';
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

/** A color inventory must also tell a component author which token fits the intended role. */
export async function expectColorRoles(scope: Locator): Promise<void> {
	const palette = scope.getByRole('region', { name: 'Colors', exact: true });
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
	await expect(base.locator('[data-style-token]')).toHaveAttribute('data-style-token', '--hx-gold');
	const treatments = primary.getByRole('group', { name: 'Treatments', exact: true });
	await expect(treatments, 'Primary variants are subordinate treatments').toBeVisible();
	await expect(treatments.locator('[data-style-token="--hx-gold-soft"]')).toHaveCount(1);
	await expect(base.locator('[data-style-token="--hx-gold-soft"]')).toHaveCount(0);
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
