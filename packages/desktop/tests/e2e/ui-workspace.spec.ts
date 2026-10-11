import { fakeProject } from './ui-workspace-fixture';
import { expect, test } from '@playwright/test';

test('browser preview exposes no writable backend', async ({ page }) => {
	await page.goto('/');
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.waitForFunction(() => Boolean(document.querySelector('h1')));
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: 'test-results/ui-preview.png', fullPage: true });
	}
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeDisabled();
	await expect(page.getByText(/Browser preview · read-only/)).toBeVisible();
});

test('designless Plan preserves truthful status and branch/commit paths', async ({ page }) => {
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link')
	).toHaveCount(5);
	await expect(page.getByRole('link', { name: 'Review designs' })).toHaveAttribute(
		'href',
		'/harness/branch/feat%2Factivity/pages/page%3Aactivity'
	);
	await page.getByRole('link', { name: 'Review designs' }).click();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
		});
		await page.screenshot({ path: 'test-results/ui-initial-plan.png', fullPage: true });
	}
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/pages\/page%3Aactivity$/);
	await expect(page.getByRole('heading', { name: 'No design image yet' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Claude CLI', exact: true })).toBeDisabled();
	await expect(page.getByText('src/activity.svelte', { exact: true })).toHaveCount(0);
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Create the first Activity design');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('Create the first Activity design');
	await page.getByLabel('Commit', { exact: true }).selectOption('b'.repeat(40));
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/commit\/b{40}\/pages/);
	await expect(page.getByRole('button', { name: 'New page' })).toBeDisabled();
	await expect(page.getByRole('link', { name: 'Review designs' })).toHaveAttribute(
		'href',
		`/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/pages/page%3Aactivity`
	);
	await expect(
		page
			.getByRole('navigation', { name: 'Catalog categories' })
			.getByRole('link', { name: 'Components', exact: true })
	).toHaveAttribute('href', `/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/components`);
});

test('catalog search, changed filter and new plan draft', async ({ page }) => {
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
	await page.getByRole('checkbox', { name: 'Changed only', exact: true }).check();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toHaveCount(0);
	await page.getByRole('textbox', { name: 'Search pages', exact: true }).fill('missing');
	await expect(page.getByText('No pages match this view.')).toBeVisible();
	await page.getByRole('button', { name: 'New page' }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Activity');
	await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Make work visible');
	await page.getByRole('button', { name: 'Create plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('Make work visible');
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
});

test('Go to tip exits both historical and explicitly pinned tip revisions', async ({ page }) => {
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	for (const commit of ['b'.repeat(40), 'a'.repeat(40)]) {
		await page.getByLabel('Commit', { exact: true }).selectOption(commit);
		await expect(page).toHaveURL(new RegExp(`/commit/${commit}/pages$`));
		await expect(page.getByRole('button', { name: 'New page' })).toBeDisabled();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({
				path: `test-results/go-to-tip-${process.env.SCREENSHOT_LABEL ?? 'local'}-${commit[0]}.png`
			});
		}
		await page.getByRole('button', { name: 'Go to tip', exact: true }).click();
		await expect(page).toHaveURL(/\/harness\/branch\/feat%2Factivity\/pages$/);
		await expect(page.getByLabel('Commit', { exact: true })).toHaveValue('a'.repeat(40));
		await expect(page.getByRole('button', { name: 'New page' })).toBeEnabled();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({
				path: `test-results/go-to-tip-${process.env.SCREENSHOT_LABEL ?? 'local'}-returned-${commit[0]}.png`
			});
		}
	}
});
