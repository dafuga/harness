import type { Page } from '@playwright/test';
import { fakeProject } from './ui-workspace-fixture';
import { fakeDeploymentActivity } from './ui-deployment-fixture';
import { expect, test } from '../../../../test/support/browserTest';

test('production promotion previews preprod distance, requires one action and reports live status', async ({
	page
}) => {
	await fakeProject(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await page.getByLabel('Environment', { exact: true }).selectOption('preprod');
	await page.getByRole('button', { name: 'Deploy', exact: true }).click();
	await page.evaluate(() => document.fonts.ready);
	await capture(page, 'production-promotion');
	const dialog = page.getByRole('dialog', { name: 'Deploy', exact: true });
	await expect(
		dialog.getByText('Production is behind preprod by 3 commits.', { exact: true })
	).toBeVisible();
	await expect(dialog.getByText('c'.repeat(40), { exact: true })).toBeVisible();
	await expect(dialog.getByText('b'.repeat(40), { exact: true })).toBeVisible();
	await expect(dialog.getByRole('button')).toHaveCount(1);
	await page.setViewportSize({ width: 390, height: 844 });
	await capture(page, 'production-mobile');
	await mobileDialog(page, 'Deploy');
	for (const commit of ['c'.repeat(40), 'b'.repeat(40)]) {
		const code = dialog.getByText(commit, { exact: true });
		await expect(code).toBeVisible();
		const bounds = await code.boundingBox();
		expect(bounds!.x).toBeGreaterThanOrEqual(0);
		expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
	}
	expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	await page.setViewportSize({ width: 1440, height: 900 });
	expect(
		await page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
	).not.toContain('"op":"deploy"');
	await dialog.getByRole('button', { name: 'Promote to production', exact: true }).click();
	await expect(dialog.getByRole('status')).toContainText('Checking the preprod commit');
	await capture(page, 'production-progress');
	await expect(dialog.getByRole('status')).toContainText('Deployed to prod');
	await expect(
		dialog.getByRole('button', { name: 'Promote to production', exact: true })
	).toBeDisabled();
	await expect(dialog.getByText('Verified receipt', { exact: true })).toBeVisible();
	await capture(page, 'production-complete');
	await page.setViewportSize({ width: 320, height: 480 });
	await capture(page, 'production-complete-mobile');
	await mobileDialog(page, 'Deploy');
	const action = await dialog
		.getByRole('button', { name: 'Promote to production', exact: true })
		.boundingBox();
	expect(
		action!.y + action!.height,
		'Promotion action remains in the viewport'
	).toBeLessThanOrEqual(480);
	await page.setViewportSize({ width: 667, height: 375 });
	await capture(page, 'production-complete-landscape');
	await mobileDialog(page, 'Deploy');
	const landscapeAction = await dialog
		.getByRole('button', { name: 'Promote to production', exact: true })
		.boundingBox();
	expect(landscapeAction!.y + landscapeAction!.height).toBeLessThanOrEqual(375);
	await dialog.getByText('Verified receipt', { exact: true }).scrollIntoViewIfNeeded();
	await expect(dialog.getByText('Verified receipt', { exact: true })).toBeVisible();
});

test('deployment activity shows concurrent destinations and opens their current step', async ({
	page
}) => {
	await fakeProject(page, true);
	await fakeDeploymentActivity(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await page.evaluate(() => document.fonts.ready);
	await capture(page, 'activity-light');
	const light = page.getByRole('button', { name: 'Deployments', exact: true });
	await expect(light).toBeVisible();
	await expect(light).toHaveAttribute('data-active', '3');
	await expect(light).toHaveText('');
	await expect(page.getByRole('banner')).not.toContainText(
		/Run checks|Uploading preprod|Building stage/
	);
	await expect(page.getByRole('dialog', { name: 'Deployments', exact: true })).not.toBeVisible();
	await light.click();
	const dialog = page.getByRole('dialog', { name: 'Deployments', exact: true });
	for (const environment of ['prod', 'preprod', 'stage', 'dev'])
		await expect(
			dialog.getByRole('button', { name: new RegExp('^' + environment + ' deployment') })
		).toBeVisible();
	await capture(page, 'activity-list');
	for (const route of ['preprod → prod', 'stage → preprod', 'dev → stage', 'feat/activity → dev'])
		await expect(dialog.getByText(route, { exact: true })).toBeVisible();
	await expect(
		dialog.getByRole('group', { name: 'From preprod to prod', exact: true })
	).toBeVisible();
	await dialog.getByRole('button', { name: /preprod deployment/ }).click();
	await expect(dialog.getByRole('status')).toContainText('Uploading preprod');
	await expect(
		dialog.getByRole('list', { name: 'Deployment steps' }).locator('[aria-current="step"]')
	).toContainText('Deploy to Cloudflare');
	await capture(page, 'activity-detail');
	await expect(dialog.getByText('stage → preprod', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Back to deployments', exact: true }).click();
	await dialog.getByRole('button', { name: /^stage deployment/ }).click();
	await expect(dialog.getByRole('status')).toContainText('Building stage');
	await page.keyboard.press('Escape');
	await expect(light).toBeFocused();
	await expect(dialog).not.toBeVisible();
	await expect(light).toHaveAttribute('data-active', '3');
});

test('mobile deployment details retain queued and failed steps when status reads fail', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await fakeProject(page, true);
	await fakeDeploymentActivity(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	const light = page.getByRole('button', { name: 'Deployments', exact: true });
	await expect(light).toHaveAttribute('data-active', '1');
	expect(await light.locator('.pulse').evaluate((el) => getComputedStyle(el).animationName)).toBe(
		'none'
	);
	const bounds = await light.boundingBox();
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
	await light.click();
	const dialog = page.getByRole('dialog', { name: 'Deployments', exact: true });
	await expect(dialog.getByRole('alert')).toContainText('last known deployments');
	await dialog.getByRole('button', { name: /^prod deployment/ }).click();
	await expect(dialog.getByRole('status')).toHaveText('Queued for prod');
	await expect(dialog.locator('[aria-current="step"]')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Back to deployments', exact: true }).click();
	await dialog.getByRole('button', { name: /^preprod deployment/ }).click();
	await expect(
		dialog.getByRole('alert').filter({ hasText: 'Cloudflare upload failed' })
	).toBeVisible();
	await expect(dialog.locator('[aria-current="step"]')).toContainText('Deploy to Cloudflare');
	await page.evaluate(() => document.fonts.ready);
	await capture(page, 'activity-mobile-failure');
	await mobileDialog(page, 'Deployments');
	await page.setViewportSize({ width: 320, height: 480 });
	await capture(page, 'activity-small-failure');
	await mobileDialog(page, 'Deployments');
	await dialog
		.getByRole('button', { name: 'Back to deployments', exact: true })
		.scrollIntoViewIfNeeded();
	await dialog.getByRole('button', { name: 'Back to deployments', exact: true }).click();
	await expect(dialog.getByRole('button', { name: /^prod deployment/ })).toBeVisible();
});

/** One evidence checkpoint for these deployment scenarios; normal verification writes no captures. */
async function capture(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		for (const image of document.querySelectorAll('dialog[open] img')) {
			const item = image as HTMLImageElement;
			await item.decode();
			if (!item.complete || !item.naturalWidth || !item.naturalHeight)
				throw new Error('Deployment evidence image is not ready');
		}
	});
	await page.screenshot({
		path: `/tmp/harness-env-evidence/${name}-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
	});
}

/** Every mobile dialog stays inside the visual viewport; its own content may scroll. */
async function mobileDialog(page: Page, name: string) {
	const dialog = page.getByRole('dialog', { name, exact: true });
	const bounds = await dialog.boundingBox();
	const viewport = page.viewportSize()!;
	expect(bounds!.x).toBeGreaterThanOrEqual(8);
	expect(bounds!.y).toBeGreaterThanOrEqual(8);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 8);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 8);
	expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}
