import { expect, type Page } from '../../../test/support/browserTest';
import { capture, fits } from './entityPreviewPage';
import { commits } from './entityUnits';
import { configExpression, configRemoteExpression, configStrings } from './entityConfigFixtures';

export const configUnits = [
	'reports.component.harness-explorer-table',
	'reports.component.harness-explorer-index',
	'reports.component.harness-explorer-content'
];

export async function inspectConfigValues(
	page: Page,
	viewport: string,
	commit: string
): Promise<void> {
	const table = page.getByRole('table', { name: 'orderSettings', exact: true });
	await capture(page, `groups-config-values-${commit.slice(0, 7)}-${viewport}`, configUnits);
	await inspectConfigStrings(page);
	for (const [name, value] of [
		['schema', configExpression(commit)],
		['remoteEndpoint', configRemoteExpression]
	]) {
		const row = table
			.getByRole('row')
			.filter({ has: page.getByRole('link', { name, exact: true }) });
		expect((await row.boundingBox())!.height, 'long values stay compact').toBeLessThan(150);
		const inspect = row.getByRole('button', { name: `View value for orderSettings.${name}` });
		expect(
			await inspect.innerText(),
			'value controls have icons without View value text'
		).not.toContain('View value');
		await expect(row.locator('.ex-value-preview')).toHaveCount(0);
		if (name === 'schema') await expect(row).toContainText('5 attributes');
		await inspect.press('Enter');
		const dialog = page.getByRole('dialog', { name: `orderSettings.${name} · Value`, exact: true });
		await capture(page, `groups-config-${name}-${commit.slice(0, 7)}-${viewport}`, configUnits);
		await expect(dialog).toBeVisible();
		if (name === 'schema') {
			await expect(
				dialog.getByRole('region', { name: 'Value contents', exact: true })
			).toContainText('pageSize');
			await expect(dialog).toContainText(
				commit === commits.first ? 'z.literal(10)' : 'z.literal(25)'
			);
			await dialog.getByText('Source expression', { exact: true }).click();
		}
		expect(await dialog.locator('pre code').textContent()).toBe(value);
		await expect(dialog.locator('orders')).toHaveCount(0);
		expect(await fits(page)).toBe(true);
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(inspect).toBeFocused();
	}
	await expect(
		table.getByRole('row').filter({ has: page.getByRole('link', { name: 'enabled', exact: true }) })
	).toContainText('false');
	expect(await table.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
}

/** Decoded strings stay readable in the cell, independently of their source length or line breaks. */
async function inspectConfigStrings(page: Page): Promise<void> {
	const table = page.getByRole('table', { name: 'orderSettings', exact: true });
	for (const [name, literal] of Object.entries(configStrings)) {
		const row = table
			.getByRole('row')
			.filter({ has: page.getByRole('link', { name, exact: true }) });
		const text = row.getByRole('img', { name: `String ${literal}`, exact: true });
		await expect.soft(text, 'decoded strings are visible inline').toBeVisible({ timeout: 500 });
		await expect
			.soft(row.getByRole('button', { name: `View value for orderSettings.${name}`, exact: true }))
			.toHaveCount(0);
		if (!(await text.count())) continue;
		await expect.soft(text).toHaveText(literal);
		const layout = await text.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				width: element.clientWidth,
				clipped: element.scrollWidth > element.clientWidth,
				lines: element.getBoundingClientRect().height / Number.parseFloat(style.lineHeight),
				ellipsis: style.textOverflow,
				whitespace: style.whiteSpace
			};
		});
		expect.soft(layout.width, 'the beginning has visible space').toBeGreaterThan(0);
		expect.soft(layout.lines, 'multiline strings occupy one line').toBeLessThan(1.1);
		expect.soft(layout.clipped).toBe(name !== 'defaultSort');
		if (name !== 'defaultSort') {
			expect.soft(layout.ellipsis).toBe('ellipsis');
			expect.soft(layout.whitespace).toBe('nowrap');
		}
		await expect.soft(row.locator('orders')).toHaveCount(0);
	}
}

export async function inspectConfigCollections(page: Page, viewport: string): Promise<void> {
	const table = page.getByRole('table', { name: 'orderSettings', exact: true });
	const schema = table
		.getByRole('row')
		.filter({ has: page.getByRole('link', { name: 'schema', exact: true }) });
	const steps = table
		.getByRole('row')
		.filter({ has: page.getByRole('link', { name: 'steps', exact: true }) });
	const inspect = steps.getByRole('button', {
		name: 'View value for orderSettings.steps',
		exact: true
	});
	await capture(page, `groups-config-collections-${viewport}`, configUnits);
	await expect(steps).toContainText('2 items');
	await expect(
		table
			.getByRole('row')
			.filter({ has: page.getByRole('link', { name: 'emptySteps', exact: true }) })
	).toContainText('0 items');
	expect(await steps.locator('button svg path').getAttribute('d')).not.toBe(
		await schema.locator('button svg path').getAttribute('d')
	);
	await inspect.press('Enter');
	const dialog = page.getByRole('dialog', { name: 'orderSettings.steps · Value', exact: true });
	const contents = dialog.getByRole('region', { name: 'Value contents', exact: true });
	await contents.locator('summary').filter({ hasText: /^0\b/ }).click();
	await contents
		.locator('summary')
		.filter({ hasText: /^flags\b/ })
		.click();
	await capture(page, `groups-config-collections-expanded-${viewport}`, configUnits);
	await expect(contents).toContainText('Pack');
	await expect(contents).toContainText('true');
	await expect(contents).toContainText('false');
	expect(await fits(page)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(inspect).toBeFocused();
}
