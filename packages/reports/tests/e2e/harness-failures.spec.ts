import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatedFailures } from '../../scripts/harness-scale-data';
import { viewports } from './support/harnessCapture';
import { home, seeded } from './support/harnessHistory';

/**
 * A record with hundreds of failures, as the first record of a real repository has one for
 * every unit without a baseline. The page says how many there are and what caused them, keeps
 * every one of them readable on demand, and leaves the scenarios and the gallery within reach.
 */
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const { commits } = seeded();
const stored = JSON.parse(
	readFileSync(join(home, 'scale/revisions', `${commits.grown}.json`), 'utf8')
) as { records: Array<{ id: string; status: string; failures: string[] }> };
const record = stored.records.find((item) => item.status === 'failed') ?? stored.records[0];
const total = record.failures.length;
const own = record.failures.filter((failure) => !generatedFailures.includes(failure));
const id = record.id.slice(0, 12);

type Viewport = (typeof viewports)[number];

/** The page of the failed record at one viewport, and the parts of it the tests look at. */
async function shown(page: Page, viewport: Viewport) {
	await page.setViewportSize({ width: viewport.width, height: viewport.height });
	await page.goto(
		`${scale}/harness/branch/main/commit/${commits.grown}/history/record/${record.id}`
	);
	const records = page.getByRole('list', { name: 'Verification records' });
	const item = records.getByRole('listitem').filter({ hasText: `Record ${id}` });
	const failures = item.getByRole('group', { name: `Failures of record ${id}` });
	const scenarios = page.getByRole('heading', { name: `Scenarios of record ${id}` });
	const distance = async () =>
		((await scenarios.boundingBox())?.y ?? 0) - ((await records.boundingBox())?.y ?? 0);
	const last = failures.getByText(record.failures[total - 1], { exact: true });
	return { records, item, failures, distance, last };
}

for (const viewport of viewports) {
	test(`hundreds of failures read as their number and causes at the ${viewport.id} viewport`, async ({
		page
	}) => {
		expect([total > 400, own.length > 0]).toEqual([true, true]);
		const { records, item, failures, distance, last } = await shown(page, viewport);
		// The record is what it was: failed, with the number of failures it has.
		await expect(item).toContainText('Failed');
		await expect(failures).toContainText(`${total} failures`);
		const causes = failures.getByRole('group', { name: 'Failures by cause' });
		// The records stay the only items of their list, however many failures one of them has.
		await expect(records.getByRole('listitem')).toHaveCount(stored.records.length);
		await expect(causes).toContainText(
			`${generatedFailures.length} times: no baseline is established; a reviewer must establish one`
		);
		await expect(causes).toContainText(
			`function.generated-000, function.generated-001, function.generated-002 and ${generatedFailures.length - 3} more`
		);
		// A failure nothing else shares is in the summary word for word.
		for (const failure of own)
			await expect(causes.getByText(failure, { exact: true })).toBeVisible();
		// Collapsed, the scenarios start within two screens of the records, and nothing is cut off.
		await expect(last).toBeHidden();
		expect(await distance()).toBeLessThan(viewport.height * 2);
		await expect(page.locator('.evidence-card').first()).toBeAttached();
	});

	test(`every failure stays readable through a disclosure the keyboard opens at the ${viewport.id} viewport`, async ({
		page
	}) => {
		const { failures, distance, last } = await shown(page, viewport);
		// The disclosure is a control of its own: focus and Enter open it, Enter closes it again.
		const disclosure = failures.locator('summary');
		await expect(disclosure).toHaveText(`All ${total} failures as recorded`);
		await disclosure.focus();
		await page.keyboard.press('Enter');
		const all = failures.getByRole('region', { name: `All failures of record ${id}` });
		expect(await all.locator('p').allTextContents()).toEqual(record.failures);
		await last.scrollIntoViewIfNeeded();
		await expect(last).toBeVisible();
		// Open, the list scrolls in its own box: the scenarios have not moved away.
		expect(await distance()).toBeLessThan(viewport.height * 3);
		const sideways = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(sideways).toBeLessThanOrEqual(0);
		await disclosure.focus();
		await page.keyboard.press('Enter');
		await expect(last).toBeHidden();
	});
}
