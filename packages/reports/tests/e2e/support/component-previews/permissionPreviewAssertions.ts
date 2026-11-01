import { expect, type Locator, type Page } from '@playwright/test';

/** Capture the keyboard and pointer states of the real profile link and data region. */
export async function preparePermissionState(component: Locator, variant: string) {
	const profile = component.getByRole('link', { name: 'Administrator', exact: true });
	if (variant === 'index-link-focused') await profile.focus();
	if (variant === 'index-link-hovered') await profile.hover();
	if (variant === 'data-focused')
		await component
			.getByRole('region', { name: /data access/ })
			.first()
			.focus();
}

/** The endpoint panel uses the same Explorer card treatment as its real parent page. */
export async function assertPermissionPanelStyles(component: Locator) {
	const panel = component.locator(
		'[data-harness-component="networking-security-explorer-permissions-screen"]'
	);
	await expect(panel, 'Permission panel retains Explorer card styling').toHaveCSS(
		'display',
		'grid'
	);
	await expect(panel).toHaveCSS('border-top-style', 'solid');
}

/** Permission grants remain legible and reachable at every viewport. */
export async function assertPermissionTable(component: Locator, page: Page, mobile = false) {
	const identifier = component.getByRole('table').first().locator('tbody code').first();
	expect(
		await identifier.evaluate((node) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return [...range.getClientRects()].filter((box) => box.width > 0).length;
		}),
		'Data identifiers remain unbroken'
	).toBe(1);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		'Permission tables stay inside the document'
	).toBe(true);
	const region = component.getByRole('region', { name: /data access/ }).first();
	if (await region.evaluate((node) => node.scrollWidth > node.clientWidth)) {
		expect(mobile, 'Mobile permission grants retain every field without horizontal scrolling').toBe(
			false
		);
		await region.focus();
		await region.press('ArrowRight');
		await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
	}
}

/** Profiles and endpoint panels keep their own grants, gaps and empty states visible. */
export async function assertPermissionState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		index: 'Users & Permissions',
		guest: 'No API access declared.',
		admin: 'All accounts',
		empty: 'No profiles are declared',
		unindexed: 'No permission catalog is indexed',
		'not-found': 'Profile not found',
		gap: 'Policy manifest is unavailable at this revision.',
		'empty-data': 'No data access declared.',
		endpoint: 'Administrator',
		'endpoint-empty': 'No access declaration names this endpoint'
	};
	if (words[variant]) await expect(component).toContainText(words[variant]);
	if (variant === 'index') await expect(component.locator('article')).toHaveCount(3);
	if (variant === 'endpoint') await expect(component.locator('article')).toHaveCount(2);
	if (variant.startsWith('index-link-')) {
		const link = component.getByRole('link', { name: 'Administrator', exact: true });
		const selector = variant === 'index-link-focused' ? ':focus-visible' : ':hover';
		expect(await link.evaluate((node, state) => node.matches(state), selector)).toBe(true);
	}
	if (variant === 'data-focused')
		await expect(component.getByRole('region', { name: /data access/ }).first()).toBeFocused();
}
