import { expect, test, type Page } from '@playwright/test';
import { brief, revision, seeded, short } from './support/harnessHistory';

const { commits } = seeded();
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const states = (page: Page) =>
	page.getByRole('region', { name: 'Recorded states, before and after' });
const cards = (page: Page) => states(page).locator('.evidence-card:not(.audio-card)');
const choose = (page: Page, name: string, value: string) =>
	states(page).getByRole('combobox', { name }).selectOption(value);
const compare = (base: string, head: string) => `/harness?view=compare&base=${base}&commit=${head}`;
const recordOf = (commit: string, failure?: RegExp) =>
	revision(commit).records.find((record) =>
		failure ? record.failures.some((text) => failure.test(text)) : record.status === 'passed'
	);

test('a state is shown as it was recorded before and after, each side with its own source', async ({
	page
}) => {
	// Between these two commits the function the page shows grew, so the page was captured anew.
	await page.goto(compare(commits.baseline, commits.grown));
	await choose(page, 'Scenario', 'titles-page');
	await choose(page, 'State', 'empty');
	await choose(page, 'Viewport', 'desktop');
	await expect(cards(page)).toHaveCount(1);
	const aligned = states(page).getByRole('list', { name: 'Aligned states' }).getByRole('listitem');
	await expect(aligned).toHaveCount(1);
	await expect(aligned).toContainText(
		`before: Fresh capture, build fixture-build of ${brief(commits.baseline)}`
	);
	await expect(aligned).toContainText(
		`after: Fresh capture, build fixture-build of ${brief(commits.grown)}`
	);

	await cards(page).getByRole('button', { name: /^Open/ }).click();
	const viewer = page.getByRole('dialog');
	await expect(viewer).toContainText(`After at ${short(commits.grown)} · Fresh capture`);
	await viewer.getByRole('button', { name: 'View before screenshot' }).click();
	await expect(viewer).toContainText(`Before at ${short(commits.baseline)} · Fresh capture`);
	await expect(viewer).toContainText(
		`Captured from build fixture-build of revision ${commits.baseline}.`
	);
	await viewer.getByRole('button', { name: 'Compare' }).click();
	const images = viewer.locator('img');
	await expect(images).toHaveCount(2);
	for (const image of await images.all()) {
		await expect(image).toHaveJSProperty('complete', true);
		expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1440);
	}
	// The two sides are different recordings, not one image shown twice.
	const sources = await images.evaluateAll((list) =>
		list.map((item) => (item as HTMLImageElement).src)
	);
	expect(new Set(sources).size).toBe(2);
});

test('inherited, rejected and missing sides say what they are instead of filling the gap', async ({
	page
}) => {
	// Inherited: the retained commit did not touch the page, so its side is the earlier capture.
	const inherited = recordOf(commits.retained)?.scenarios.find((item) => item.id === 'titles-page');
	await page.goto(compare(commits.baseline, commits.retained));
	await choose(page, 'Scenario', 'titles-page');
	await choose(page, 'State', 'filled');
	await choose(page, 'Viewport', 'tablet');
	const aligned = states(page).getByRole('list', { name: 'Aligned states' }).getByRole('listitem');
	await expect(aligned).toContainText(
		`after: Inherited capture, build fixture-build of ${brief(inherited?.origin.commit ?? '')}`
	);

	// Rejected and missing: two failed records of one commit, chosen as the head record.
	const stale = recordOf(commits.reordered, /was produced by revision/);
	const skipped = recordOf(
		commits.reordered,
		/missing screenshot for state filled at viewport mobile/
	);
	await page.goto(compare(commits.removed, commits.reordered));
	await choose(page, 'Scenario', 'titles-page');
	await choose(page, 'Head record', stale?.id ?? '');
	await choose(page, 'State', 'empty');
	await choose(page, 'Viewport', 'desktop');
	await expect(aligned).toContainText('after: Rejected capture from another revision');
	await expect(aligned).toContainText(`build fixture-build of ${brief(commits.baseline)}`);
	await choose(page, 'Head record', skipped?.id ?? '');
	await choose(page, 'State', 'filled');
	await choose(page, 'Viewport', 'mobile');
	await expect(aligned).toContainText(
		`before: Fresh capture, build fixture-build of ${brief(commits.removed)}`
	);
	await expect(aligned).toContainText(
		`after: no capture of filled at mobile in record ${brief(skipped?.id ?? '')}`
	);
	await expect(cards(page).locator('.missing')).toBeVisible();

	// A commit nobody verified has nothing recorded: every state of it is a stated gap.
	await page.goto(compare(commits.reordered, commits.unverified));
	await expect(states(page)).toContainText(
		`Nothing was recorded for ${short(commits.unverified)}: it has no verification record.`
	);
	await choose(page, 'Scenario', 'titles-page');
	await choose(page, 'State', 'empty');
	await choose(page, 'Viewport', 'desktop');
	await expect(aligned).toContainText(
		`after: no capture of empty at desktop: ${short(commits.unverified)} has no verification record`
	);
});

test('the recorded audio of both revisions plays side by side with its transcripts', async ({
	page
}) => {
	await page.goto(compare(commits.baseline, commits.shout));
	await choose(page, 'Scenario', 'titles-audio');
	const pair = states(page).locator('.audio-comparison-card');
	await expect(pair).toHaveCount(1);
	await pair.getByRole('button', { name: /^Open/ }).click();
	const viewer = page.getByRole('dialog');
	const players = viewer.locator('audio');
	await expect(players).toHaveCount(2);
	await expect(viewer.getByText('Synthetic test tone. No speech.').first()).toBeVisible();
	const second = players.nth(1);
	await second.evaluate((element: HTMLAudioElement) => element.play());
	await expect
		.poll(() => second.evaluate((element: HTMLAudioElement) => element.duration))
		.toBeCloseTo(0.25, 1);
});

test('growth leads to the evidence before and after the commit that caused it', async ({
	page
}) => {
	await page.goto('/harness?view=growth&unit=function.slugify');
	const row = page
		.getByRole('table', { name: 'Growth of function.slugify' })
		.getByRole('row')
		.filter({ hasText: 'leave over-long titles unchanged' });
	await row.getByRole('button', { name: 'Evidence before and after' }).click();
	await expect(page).toHaveURL(new RegExp(`/commit/${commits.grown}/compare/[0-9a-f]{40}`));
	await expect(states(page)).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Commit', exact: true })).toHaveValue(
		commits.grown
	);
});

for (const [label, width, height] of [
	['tablet', 920, 800],
	['mobile', 390, 844]
] as const)
	test(`before and after fit a ${label} screen, and their media stays protected`, async ({
		page,
		request
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(compare(commits.baseline, commits.shout));
		await choose(page, 'Scenario', 'titles-page');
		await choose(page, 'State', 'empty');
		await expect(cards(page).first()).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		const source = await cards(page).locator('img').first().getAttribute('src');
		const refused = await request.get(`http://127.0.0.1:${lockedPort}${source}`);
		expect(refused.status()).toBe(403);
	});
