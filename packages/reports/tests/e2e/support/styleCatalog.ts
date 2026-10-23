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
	const palette = scope.getByRole('region', { name: 'Color roles', exact: true });
	await expect(palette, 'Styles explains primary and secondary color roles').toBeVisible();
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
	expect(references.length, 'Color roles name the CSS variables to use').toBeGreaterThan(1);
	const known = new Set(declaredStyleTokens());
	expect(
		references.filter((name) => !known.has(name)),
		'Role variables exist in the app catalog'
	).toEqual([]);
}
