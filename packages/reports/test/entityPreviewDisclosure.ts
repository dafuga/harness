import { expect, type Page, type Locator } from '@playwright/test';
import { capture, fits, open } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** A heading controls only its contents, keeps the count, and leaves sibling groups open. */
async function toggle(page: Page, heading: Locator, checkpoint: string): Promise<void> {
	const name = (await heading.innerText()).replace(/\s+/g, ' ').trim();
	const control = page.getByRole('button', { name, exact: true });
	await capture(page, `${checkpoint}-open`);
	await expect(control, 'each group heading offers an initially expanded control').toHaveAttribute(
		'aria-expanded',
		'true'
	);
	const id = await control.getAttribute('aria-controls');
	expect(id, 'the heading names its controlled content').toBeTruthy();
	const body = page.locator(`[id="${id}"]`);
	await expect(body).toBeVisible();
	const articles = await body.getByRole('article').count();
	await control.focus();
	await control.press('Enter');
	await capture(page, `${checkpoint}-closed`);
	await expect(control).toHaveAttribute('aria-expanded', 'false');
	await expect(body).toBeHidden();
	await expect(heading).toHaveText(name);
	await expect(control).toBeFocused();
	await expect(page.getByRole('heading').getByRole('button', { expanded: false })).toHaveCount(1);
	await control.press('Space');
	await expect(body).toBeVisible();
	await expect(control).toHaveAttribute('aria-expanded', 'true');
	await expect(body.getByRole('article')).toHaveCount(articles);
	await control.click();
	await expect(body).toBeHidden();
	await control.click();
	await expect(body).toBeVisible();
	expect(await fits(page)).toBe(true);
}

/** The same contract covers all catalog kinds, both relation directions, and design tokens. */
export async function reviewGroupDisclosure(page: Page, viewport: string): Promise<void> {
	for (const category of [
		'pages',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models',
		'types'
	] as const) {
		await open(page, { category, commit: commits.middle }, 'groups');
		await toggle(
			page,
			page.locator('.ex-index').getByRole('heading', { level: 2 }).first(),
			`disclosure-${category}-${viewport}`
		);
		if (category === 'components') {
			await page.getByRole('button', { name: /^Orders \d+$/ }).click();
			await page.getByRole('searchbox').fill('OrderList');
			await expect(page.getByRole('article', { name: 'OrderList', exact: true })).toBeVisible();
		}
	}
	for (const tab of ['used-in', 'uses'] as const) {
		await open(
			page,
			{
				category: tab === 'uses' ? 'pages' : 'functions',
				entity: tab === 'uses' ? ids.page : ids.filter,
				commit: commits.middle,
				tab
			},
			'relations'
		);
		await toggle(
			page,
			page.locator('.ex-relations').getByRole('heading', { level: 3 }).first(),
			`disclosure-${tab}-${viewport}`
		);
	}
	await open(page, { screen: 'styles' });
	await toggle(
		page,
		page.getByRole('heading', { level: 2, name: /^Colors/ }),
		`disclosure-styles-${viewport}`
	);
}
