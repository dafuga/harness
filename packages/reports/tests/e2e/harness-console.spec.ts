import { expect, test, type Page } from '@playwright/test';
import { revision, seeded, short } from './support/harnessHistory';

const { commits } = seeded();
const details = (page: Page) => page.getByRole('region', { name: 'Component details' });
const impact = (page: Page) => page.getByRole('region', { name: 'Impact' });
const group = (page: Page, name: string) =>
	impact(page).getByRole('list', { name }).getByRole('listitem');

test('the component map is searchable, keyboard operable and has a text alternative', async ({
	page
}) => {
	const media: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/harness/media/')) media.push(request.url());
	});
	await page.goto(`/harness?commit=${commits.reordered}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Harness' })).toBeVisible();
	const map = page.getByRole('group', { name: 'Component map' });
	await expect(map.getByRole('button', { name: /^function\.slugify,/ })).toBeVisible();
	const list = page.getByRole('list', { name: 'Components' });
	await expect(list.getByRole('button', { name: /^service\.title/ })).toBeVisible();
	await expect(list.getByRole('button', { name: /^function\.extra/ })).toHaveCount(0);

	await page.getByRole('searchbox', { name: 'Search components' }).fill('title');
	await expect(list.getByRole('button')).toHaveText([/page\.titles/, /service\.title/]);
	await expect(map.locator('[data-unit="function.clock"]')).toHaveAttribute('aria-hidden', 'true');
	await expect(map.getByRole('button', { name: /^function\.clock,/ })).toHaveCount(0);
	await page.getByRole('searchbox', { name: 'Search components' }).fill('');

	await map.getByRole('button', { name: /^service\.title,/ }).focus();
	await page.keyboard.press('Enter');
	await expect(details(page).getByRole('heading', { name: 'service.title' })).toBeVisible();
	await expect(details(page).getByText('Owns the TitleService service workflow.')).toBeVisible();
	const section = (name: string) => details(page).getByRole('group', { name });
	await expect(section('Owned interface')).toContainText('TitleService.run');
	await expect(
		section('Depends on').getByRole('button', { name: 'function.slugify' })
	).toBeVisible();
	await expect(section('Used by').getByRole('button', { name: 'page.titles' })).toBeVisible();
	await expect(section('Execution targets')).toContainText('module');
	await expect(section('Budgets and measurements')).toContainText('latency-warm-ms on titles-1k');
	await expect(section('Budgets and measurements')).toContainText('10 ms');
	await expect(section('Budgets and measurements')).toContainText('at most 5% worse');
	await expect(section('Scenarios')).toContainText('titles-boundary');

	await section('Used by').getByRole('button', { name: 'page.titles' }).click();
	await expect(details(page).getByRole('heading', { name: 'page.titles' })).toBeVisible();
	await expect(section('Scenarios')).toContainText('titles-page');
	await expect(section('Scenarios')).toContainText('empty, filled');
	await expect(section('Scenarios')).toContainText('desktop 1440×900');
	await expect(section('Scenarios')).toContainText('mobile 390×844');
	expect(media).toEqual([]);
});

test('a comparison shows changed, affected, added and removed units and stays on real ancestry', async ({
	page
}) => {
	await page.goto(`/harness?view=compare&base=${commits.baseline}&commit=${commits.shout}`);
	await expect(group(page, 'Directly changed')).toHaveText([/function\.slugify/]);
	await expect(group(page, 'Indirectly affected')).toHaveText([/page\.titles/, /service\.title/]);
	await expect(group(page, 'Affected scenarios')).toHaveText([
		/titles-audio/,
		/titles-boundary/,
		/titles-page/
	]);
	await expect(impact(page)).toContainText('Recorded by verification');
	await expect(impact(page)).toContainText('Fixture change.');
	const map = page.getByRole('group', { name: 'Component map' });
	await expect(
		map.getByRole('button', { name: /^function\.slugify,.*directly changed/ })
	).toBeVisible();
	await expect(
		map.getByRole('button', { name: /^service\.title,.*indirectly affected/ })
	).toBeVisible();

	const base = page.getByRole('combobox', { name: 'Base commit' });
	await expect(base.locator(`option[value="${commits.baseline}"]`)).toHaveCount(1);
	await expect(base.locator(`option[value="${commits.reordered}"]`)).toHaveCount(0);
	await expect(base.locator(`option[value="${commits.retained}"]`)).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Branch' }).locator('option')).toHaveText([
		'feature/kept#1',
		'main',
		'Retained commits'
	]);

	await page.goto(`/harness?view=compare&base=${commits.approved}&commit=${commits.established}`);
	await expect(group(page, 'Added')).toHaveText([/function\.extra/]);
	await expect(group(page, 'Uncertain')).toContainText([
		'no test or scenario depends on this file'
	]);
	await expect(group(page, 'Uncertain')).toContainText(['src/utils/extra.ts']);

	await page.goto(`/harness?view=compare&base=${commits.established}&commit=${commits.removed}`);
	await expect(group(page, 'Removed')).toHaveText([/function\.extra/]);
	await group(page, 'Removed').getByRole('button', { name: 'function.extra' }).click();
	await expect(details(page).getByRole('heading', { name: 'function.extra' })).toBeVisible();
	await expect(details(page)).toContainText('Removed in this comparison');
	await expect(details(page)).toContainText('Owns the extra shared function.');
});

test('history shows the recorded states of a revision, its failures, gaps and inherited evidence', async ({
	page
}) => {
	await page.goto(`/harness?view=history&commit=${commits.unverified}`);
	await expect(page.getByText('No verification record is attached to this commit')).toBeVisible();
	await expect(page.locator('.evidence-card')).toHaveCount(0);

	await page.goto(`/harness?view=history&commit=${commits.reordered}`);
	const records = page.getByRole('list', { name: 'Verification records' }).getByRole('listitem');
	await expect(records).toHaveCount(4);
	const recorded = page.getByRole('region', { name: 'Recorded verification' });
	await expect(recorded).toContainText('missing screenshot for state filled at viewport mobile');
	await expect(recorded).toContainText(`was produced by revision ${commits.baseline}`);
	await expect(recorded).toContainText('has a baseline only for another machine profile');

	const passing = revision(commits.reordered).records.find((record) => record.status === 'passed');
	const clock = passing?.scenarios.find((scenario) => scenario.id === 'clock');
	expect(clock?.inherited).toBe(true);
	await records.filter({ hasText: 'Passed' }).getByRole('button').click();
	const scenarios = page.getByRole('list', { name: 'Scenarios' });
	await expect(scenarios.getByRole('listitem').filter({ hasText: 'clock' })).toContainText(
		`Inherited from ${short(clock?.origin.commit ?? '')}`
	);
	await expect(scenarios.getByRole('listitem').filter({ hasText: 'titles-page' })).toContainText(
		`Tested at ${short(commits.reordered)}`
	);

	const screenshots = page.locator('.evidence-card:not(.audio-card)');
	await expect(screenshots).toHaveCount(6);
	await page.getByRole('button', { name: 'Mobile screenshots' }).click();
	await expect(screenshots).toHaveCount(2);
	const image = screenshots.locator('img').first();
	await expect(image).toHaveJSProperty('complete', true);
	expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(390);

	await page
		.locator('.media-tabs')
		.getByRole('button', { name: /^Audio/ })
		.click();
	const audio = page.locator('audio').first();
	await expect(page.getByText('Synthetic test tone. No speech.')).toBeVisible();
	// The player loads nothing until it is played, so the duration is known only afterwards.
	expect(await audio.evaluate((element: HTMLAudioElement) => element.preload)).toBe('none');
	await audio.evaluate((element: HTMLAudioElement) => element.play());
	await expect
		.poll(() => audio.evaluate((element: HTMLAudioElement) => element.duration))
		.toBeCloseTo(0.25, 1);
	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.ended)).toBe(true);
});

test('growth names the commit and reason of each change and keeps incompatible timings apart', async ({
	page
}) => {
	await page.goto(`/harness?view=growth&unit=function.slugify`);
	const rows = page.getByRole('table', { name: 'Growth of function.slugify' }).getByRole('row');
	const grown = rows.filter({ hasText: 'leave over-long titles unchanged' });
	await expect(grown).toContainText('148');
	await expect(grown).toContainText('+61');
	await expect(grown).toContainText(short(commits.grown));
	await expect(grown).toContainText(
		'Leaves over-long and query-like titles unchanged instead of slugging them.'
	);
	await expect(page.getByText('No timing was recorded for this component')).toBeVisible();

	await page.getByRole('combobox', { name: 'Component' }).selectOption('service.title');
	const timings = page.getByRole('region', { name: 'Timings of service.title' });
	await expect(timings.getByRole('table')).toHaveCount(2);
	await expect(timings).toContainText('Not comparable');
	await expect(timings).toContainText('another-runner');
	await expect(timings).toContainText('latency-warm-ms on titles-1k');
});

for (const [label, width, height] of [
	['desktop', 1440, 900],
	['tablet', 920, 800],
	['mobile', 390, 844]
] as const)
	test(`the console fits a ${label} viewport without sideways scrolling`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		for (const view of ['map', 'compare', 'history', 'growth']) {
			await page.goto(`/harness?view=${view}&commit=${commits.reordered}&unit=service.title`);
			await expect(page.getByRole('tab', { selected: true })).toBeVisible();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
		}
		await page.goto(`/harness?commit=${commits.reordered}`);
		await page
			.getByRole('list', { name: 'Components' })
			.getByRole('button', { name: /^service\.title/ })
			.click();
		await expect(details(page).getByRole('heading', { name: 'service.title' })).toBeInViewport();
	});
