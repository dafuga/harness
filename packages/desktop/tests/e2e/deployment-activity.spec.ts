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
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/production-promotion-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	const dialog = page.getByRole('dialog', { name: 'Deploy', exact: true });
	await expect(
		dialog.getByText('Production is behind preprod by 3 commits.', { exact: true })
	).toBeVisible();
	await expect(dialog.getByText('c'.repeat(40), { exact: true })).toBeVisible();
	await expect(dialog.getByText('b'.repeat(40), { exact: true })).toBeVisible();
	await expect(dialog.getByRole('button')).toHaveCount(1);
	expect(
		await page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
	).not.toContain('"op":"deploy"');
	await dialog.getByRole('button', { name: 'Promote to production', exact: true }).click();
	await expect(dialog.getByRole('status')).toContainText('Checking the preprod commit');
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/production-progress-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	await expect(dialog.getByRole('status')).toContainText('Deployed to prod');
	await expect(
		dialog.getByRole('button', { name: 'Promote to production', exact: true })
	).toBeDisabled();
});

test('deployment activity shows concurrent destinations and opens their current step', async ({
	page
}) => {
	await fakeProject(page, true);
	await fakeDeploymentActivity(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await page.evaluate(() => document.fonts.ready);
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/activity-light-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	const light = page.getByRole('button', { name: 'Deployments', exact: true });
	await expect(light).toBeVisible();
	await expect(light).toHaveAttribute('data-active', '3');
	await light.click();
	const dialog = page.getByRole('dialog', { name: 'Deployments', exact: true });
	for (const environment of ['prod', 'preprod', 'stage', 'dev'])
		await expect(
			dialog.getByRole('button', { name: new RegExp('^' + environment + ' deployment') })
		).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/activity-list-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	await dialog.getByRole('button', { name: /preprod deployment/ }).click();
	await expect(dialog.getByRole('status')).toContainText('Uploading preprod');
	await expect(
		dialog.getByRole('list', { name: 'Deployment steps' }).locator('[aria-current="step"]')
	).toContainText('Deploy to Cloudflare');
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/activity-detail-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	await dialog.getByRole('button', { name: 'Back to deployments', exact: true }).click();
	await dialog.getByRole('button', { name: /^stage deployment/ }).click();
	await expect(dialog.getByRole('status')).toContainText('Building stage');
	await page.keyboard.press('Escape');
	await expect(light).toBeFocused();
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
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/activity-mobile-failure-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
});
