import { expect, type Page } from '@playwright/test';
import { capture, fits, open, ready } from './entityPreviewPage';
import { startRoute } from './entityPreviewPlatformEvidence';
import { commits } from './entityUnits';

const heading = (page: Page, name: string) =>
	page.getByRole('heading', { level: 1, name, exact: true });
const web = (page: Page) => page.getByRole('link', { name: 'View Web configuration', exact: true });
const revision = (page: Page) => page.getByRole('combobox', { name: 'Commit', exact: true });

export async function exercisePlatformHistory(page: Page, viewport: string) {
	await open(page, { category: 'platforms' }, 'platforms');
	await revision(page).selectOption(commits.middle);
	await expect(heading(page, 'Platforms')).toBeVisible();
	await startRoute(page);
	await web(page).click();
	await expect(heading(page, 'Web')).toBeVisible();
	await expect(page.getByRole('link', { name: 'wrangler.jsonc', exact: true })).toHaveAttribute(
		'href',
		`https://github.com/example/orders/blob/${commits.middle}/wrangler.jsonc`
	);
	await capture(page, `platforms-history-${viewport}`);
	const detail = page.url();
	await page.goBack();
	await expect(heading(page, 'Platforms')).toBeVisible();
	await page.goForward();
	await expect(heading(page, 'Web')).toBeVisible();
	await expect(page).toHaveURL(detail);
	await page.reload();
	await expect(heading(page, 'Web')).toBeVisible();
	await page
		.getByRole('navigation', { name: 'Breadcrumb' })
		.getByRole('link', { name: 'Platforms', exact: true })
		.click();
	await expect(revision(page)).toHaveValue(commits.middle);
	await expect(heading(page, 'Platforms')).toBeVisible();
	expect(await fits(page)).toBe(true);
}

export async function exercisePlatformCatalogGaps(page: Page, viewport: string) {
	await open(page, { category: 'platforms', commit: commits.middle }, 'platforms-invalid');
	await expect(heading(page, 'Platforms')).toBeVisible();
	await expect(
		page.getByText(
			'Platform configuration could not be read at this revision. Check harness.platforms.json.'
		)
	).toBeVisible();
	await expect(page.getByText('Not recorded', { exact: true })).toHaveCount(4);
	await expect(page.getByRole('main')).not.toContainText('SvelteKit on Cloudflare');
	await capture(page, `platforms-invalid-catalog-${viewport}`);
	await revision(page).selectOption(commits.tip);
	await expect(page.getByText('SvelteKit on Cloudflare', { exact: true })).toBeVisible();
	await open(page, { category: 'platforms', entity: 'unknown' }, 'platforms');
	await expect(
		page.getByRole('heading', { name: 'Platform not found', exact: true })
	).toBeVisible();
	await capture(page, `platforms-unknown-${viewport}`);
	await page.getByRole('link', { name: 'All platforms', exact: true }).click();
	await expect(web(page)).toBeVisible();
	await ready(page);
	expect(await fits(page)).toBe(true);
}

export async function exercisePlatformRevisionRecovery(page: Page, viewport: string) {
	let fail = true;
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.exposeBinding('previewPlatformResponse', async (_source, path: string) => {
		if (!fail || !path.endsWith(`/revisions/${commits.middle}.json`)) return false;
		await held;
		return true;
	});
	await open(page, { category: 'platforms' }, 'platforms');
	try {
		await revision(page).selectOption(commits.middle);
		await expect(
			page.getByRole('status').filter({ hasText: 'Loading this revision…' })
		).toBeVisible();
		await expect(web(page)).toHaveCount(0);
	} finally {
		release();
	}
	await expect(
		page.getByText('This revision could not be loaded. Refresh the page to try again.')
	).toBeVisible();
	await expect(web(page)).toHaveCount(0);
	fail = false;
	await page.reload();
	await expect(heading(page, 'Platforms')).toBeVisible();
	await expect(revision(page)).toHaveValue(commits.middle);
	await expect(web(page)).toBeVisible();
	await capture(page, `platforms-recovered-${viewport}`);
}
