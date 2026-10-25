import { catalogCategories, fakeProject } from './ui-workspace-fixture';
import { expect, test } from '../../../../test/support/browserTest';
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
	for (const name of ['Choose branch', 'Choose commit']) {
		const icon = page.getByRole('button', { name, exact: true });
		expect((await icon.boundingBox())!.height).toBeLessThanOrEqual(36);
	}
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link')
	).toHaveText(catalogCategories);
	await expect(page.getByRole('link', { name: 'Open Activity' })).toHaveAttribute(
		'href',
		'/harness/branch/feat%2Factivity/pages/page%3Aactivity/designs'
	);
	await page.getByRole('link', { name: 'Open Activity' }).click();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
		});
		await page.screenshot({ path: 'test-results/ui-initial-plan.png', fullPage: true });
	}
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/pages\/page%3Aactivity\/designs$/);
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
	await page.getByRole('button', { name: 'Choose commit', exact: true }).click();
	await page.getByLabel('Commit', { exact: true }).selectOption('b'.repeat(40));
	await page.keyboard.press('Escape');
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/commit\/b{40}\/pages/);
	await page.getByRole('button', { name: 'Open project chat', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('link', { name: 'Open Activity' })).toHaveAttribute(
		'href',
		`/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/pages/page%3Aactivity/designs`
	);
	await expect(
		page
			.getByRole('navigation', { name: 'Catalog categories' })
			.getByRole('link', { name: 'Components', exact: true })
	).toHaveAttribute('href', `/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/components`);
});
test('catalog search, changed filter and conversational plan request', async ({ page }) => {
	await fakeProject(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Changed only', exact: true }).check();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toHaveCount(0);
	await page.getByRole('searchbox', { name: 'Search pages', exact: true }).fill('missing');
	await expect(page.getByText('No pages match this view.')).toBeVisible();
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Add an Activity page to make work visible');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('Add an Activity page to make work visible');
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
});
test('Go to tip exits both historical and explicitly pinned tip revisions', async ({ page }) => {
	await fakeProject(page, true);
	await page.setViewportSize({ width: 320, height: 568 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	for (const commit of ['b'.repeat(40), 'a'.repeat(40)]) {
		await page.getByRole('button', { name: 'Choose commit', exact: true }).click();
		await page.getByLabel('Commit', { exact: true }).selectOption(commit);
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(new RegExp(`/commit/${commit}/pages$`));
		await page.getByRole('button', { name: 'Open project chat', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
		await page.keyboard.press('Escape');
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({
				path: `test-results/go-to-tip-${process.env.SCREENSHOT_LABEL ?? 'local'}-${commit[0]}.png`
			});
		}
		await expect(page.locator('.revision-summary strong')).toHaveText(commit.slice(0, 7));
		await expect(page.locator('.revision-summary time')).toHaveAttribute(
			'datetime',
			commit[0] === 'a' ? '2026-10-11' : '2026-10-10'
		);
		await page.getByRole('button', { name: 'Go to tip', exact: true }).click();
		await expect(page).toHaveURL(/\/harness\/branch\/feat%2Factivity\/pages$/);
		await expect(page.locator('.revision-summary strong')).toHaveText('feat/activity');
		await expect(page.locator('.revision-summary time')).toHaveAttribute('datetime', '2026-10-11');
		await expect(page.getByLabel('Commit', { exact: true })).toHaveValue('a'.repeat(40));
		await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toBeEnabled();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({
				path: `test-results/go-to-tip-${process.env.SCREENSHOT_LABEL ?? 'local'}-returned-${commit[0]}.png`
			});
		}
	}
});
test('workspace selectors start collapsed and environment stays directly selectable', async ({
	page
}) => {
	await fakeProject(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await page.evaluate(() => document.fonts.ready);
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({
			path: `/tmp/harness-env-evidence/environment-controls-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
		});
	await expect(page.getByLabel('Commit', { exact: true })).not.toBeVisible();
	await expect(page.getByLabel('Branch', { exact: true })).not.toBeVisible();
	await expect(page.getByLabel('Project', { exact: true })).not.toBeVisible();
	await expect(page.getByLabel('Environment', { exact: true })).toBeVisible();
	const environment = await page.getByLabel('Environment', { exact: true }).boundingBox();
	for (const name of ['Choose branch', 'Choose commit', 'Deploy']) {
		const icon = await page.getByRole('button', { name, exact: true }).boundingBox();
		expect(environment!.x + environment!.width).toBeLessThan(icon!.x);
	}
	await page.getByLabel('Environment', { exact: true }).selectOption('prod');
	for (const [button, selector] of [
		['Choose commit', 'Commit'],
		['Choose branch', 'Branch'],
		['Choose workbench', 'Project']
	]) {
		await page.getByRole('button', { name: button, exact: true }).click();
		await expect(page.getByLabel(selector, { exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: button, exact: true })).toBeFocused();
	}
	for (const [width, environment] of [
		[390, 'dev'],
		[390, 'prod'],
		[320, 'dev'],
		[320, 'prod']
	] as const) {
		await page.setViewportSize({ width, height: 568 });
		await page.getByLabel('Environment', { exact: true }).selectOption(environment);
		await page.evaluate(() => document.fonts.ready);
		if (process.env.TAKE_SCREENSHOT === 'true')
			await page.screenshot({
				path: `/tmp/harness-env-evidence/mobile-header-${width}-${environment}-${process.env.SCREENSHOT_LABEL ?? 'local'}.png`
			});
		await expect(page.getByText(/Changes reach preprod\./)).toHaveCount(0);
		const summary = page.locator('.revision-summary');
		await expect(summary.locator('strong')).toHaveText('Updated at');
		await expect(summary.locator('time')).toHaveAttribute('datetime', '2026-10-20T10:15:00.000Z');
		await expect(page.locator('.environment-status')).toHaveCount(0);
		await expect(summary).not.toContainText(/Deployed|Current|branch tip|Tip|dev|prod|·/);
		const sameLine = await summary.evaluate((element) => {
			const name = element.querySelector('strong')!.getBoundingClientRect();
			const time = element.querySelector('time')!.getBoundingClientRect();
			return (
				Math.abs(name.top - time.top) < 4 && time.right <= element.getBoundingClientRect().right
			);
		});
		expect(sameLine, 'Viewed context and update time must fit on one line').toBe(true);
		const projectControl = await page
			.getByRole('button', { name: 'Choose workbench' })
			.boundingBox();
		const contextControl = await page.getByLabel('Environment', { exact: true }).boundingBox();
		expect(
			contextControl!.y - projectControl!.y - projectControl!.height,
			'Mobile project and context controls need breathing room'
		).toBeGreaterThanOrEqual(8);
		const branchFits = await page
			.locator('.revision-summary strong')
			.evaluate((element) => element.scrollWidth <= element.clientWidth);
		expect(branchFits, 'The short current branch name must remain readable on mobile').toBe(true);
		const header = await page.getByRole('banner').boundingBox();
		expect(header!.height, 'Mobile header must leave room for project content').toBeLessThanOrEqual(
			184
		);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
		for (const name of [
			'Choose workbench',
			'Choose branch',
			'Choose commit',
			'Deploy',
			'Search entities'
		])
			await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Choose commit', exact: true }).click();
		await expect(page.getByLabel('Commit', { exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
	}
});
