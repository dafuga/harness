import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import {
	at,
	checkpoint,
	explorer,
	expectPath,
	judging,
	recordedShot,
	tip,
	verdict
} from './support/explorer';
import { brief, revision, seeded, short } from './support/harnessHistory';
import { fits, screens } from './support/sharedSelect';

const { commits, keptBranch } = seeded();
const { explorerBranch, explorerUnits: units } = explorer();
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const content = (page: Page) => page.locator('.ex-content');
const before = (page: Page, sha: string) =>
	page.getByRole('figure', { name: `Before · ${short(sha)}` });
const after = (page: Page, sha: string) =>
	page.getByRole('figure', { name: `After · ${short(sha)}` });
const shot = (figure: Locator) => figure.locator('img');
const file = (figure: Locator) =>
	shot(figure).evaluate((image: HTMLImageElement) => image.src.split('/').pop() ?? '');
const page_ = `pages/${units.page}`;

test('a state is shown as it was recorded before and after, each side from its own record', async ({
	page
}) => {
	const [parent, selected] = [commits.paired, commits.twin];
	await page.goto(at(keptBranch, selected, page_));
	await checkpoint(page, 'media-pair');
	const where = { scenario: 'titles-page', state: 'empty', viewport: 'desktop' };
	expect(await file(before(page, parent))).toBe(recordedShot(parent, where));
	expect(await file(after(page, selected))).toBe(recordedShot(selected, where));
	// The commit changed what the page shows, so the two recorded pictures are not the same bytes.
	expect(recordedShot(parent, where)).not.toBe(recordedShot(selected, where));
	await page.getByRole('combobox', { name: 'State' }).selectOption('filled');
	await page
		.getByRole('group', { name: 'Viewport' })
		.getByRole('button', { name: 'Mobile' })
		.click();
	const moved = { scenario: 'titles-page', state: 'filled', viewport: 'mobile' };
	await expect.poll(() => file(after(page, selected))).toBe(recordedShot(selected, moved));
	expect(await file(before(page, parent))).toBe(recordedShot(parent, moved));
	await expect(before(page, parent)).toContainText('Parent commit');
	await expect(after(page, selected)).toContainText('Selected commit');
});

test('a branch tip shows the capture of the tip alone, and it is the one the tip recorded', async ({
	page
}) => {
	await page.goto(tip(explorerBranch, page_));
	const where = { scenario: 'titles-page', state: 'empty', viewport: 'desktop' };
	const current = content(page).locator('img[src*="/harness/media/"]');
	await expect(current).toHaveCount(1);
	expect(await current.evaluate((image: HTMLImageElement) => image.src.split('/').pop())).toBe(
		recordedShot(commits.approved, where)
	);
	await expect(content(page).getByRole('figure', { name: /^Before ·/ })).toHaveCount(0);
});

test('a side with no record says so, and nothing of another commit fills the gap', async ({
	page
}) => {
	// Neither this commit nor its parent was ever verified.
	await page.goto(at('main', commits.sourceOnly, page_));
	await checkpoint(page, 'media-gaps');
	expect(judging(commits.sourceOnly)).toBeUndefined();
	expect(judging(commits.unverified)).toBeUndefined();
	await expect(content(page).locator('img[src*="/harness/media/"]')).toHaveCount(0);
	const gap = 'No verification record is attached to this commit.';
	await expect(before(page, commits.unverified)).toContainText(gap);
	await expect(after(page, commits.sourceOnly)).toContainText(gap);
	await expect(verdict(page, 'Evidence missing').first()).toBeVisible();
});

test('rejected audio stays to be heard with its transcript, and fails the service it belongs to', async ({
	page
}) => {
	// The newest record of this commit rejected the audio for having no transcript.
	const rejected = judging(commits.restated)?.scenarios.find((item) => item.id === 'titles-audio');
	expect(rejected?.states.flatMap((state) => state.captures)).toHaveLength(1);
	await page.goto(at('main', commits.restated, `services/${units.service}`));
	await checkpoint(page, 'media-rejected-audio');
	await expect(verdict(page, 'Full coverage passed')).toHaveCount(0);
	await expect(verdict(page, 'Verification failed').first()).toBeVisible();
	await expect(
		content(page)
			.getByText(/Rejected capture/)
			.first()
	).toBeVisible();
	await expect(content(page).locator('audio')).not.toHaveCount(0);
	// A commit whose audio was accepted plays it with the transcript the fixture recorded.
	await page.goto(at('main', commits.approved, `services/${units.service}`));
	await expect(content(page).locator('audio')).not.toHaveCount(0);
	await expect(content(page).getByText('Synthetic test tone. No speech.').first()).toBeVisible();
});

test('the portable export keeps what each capture really came from', async ({ page }) => {
	const stale = revision(commits.reordered).records.find((record) =>
		record.failures.some((text) => /was produced by revision/.test(text))
	);
	if (!stale) throw new Error('the seeded history has no record with a stale capture');
	const download = await page.request.get(
		`/harness/export/${commits.reordered}?record=${stale.id}`
	);
	expect(download.status()).toBe(200);
	await page.setContent(await download.text());
	const cards = page.locator('.evidence-card:not(.audio-card)').filter({ hasText: 'titles-page' });
	await expect(cards).toHaveCount(6);
	for (const card of await cards.all()) {
		await expect(card).toContainText('Rejected capture from another revision');
		await expect(card).toContainText(`build fixture-build of ${brief(commits.baseline)}`);
		await expect(card).toContainText(
			`record ${brief(stale.id)} (failed) targeting ${brief(commits.reordered)}`
		);
		await expect(card).not.toContainText('Tested at');
	}
});

test('a link to an earlier report opens the explorer at the commit that report recorded', async ({
	page
}) => {
	await page.goto('/harness/reports/linked-run');
	await expectPath(page, at('main', commits.shout, 'pages'));
	await page.goto('/harness/reports/unlinked-run');
	await expectPath(page, tip('main', 'pages'));
});

for (const [screen, width, height] of screens) {
	test(`before and after fit a ${screen} screen, and their media stays protected`, async ({
		page,
		request
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(at(keptBranch, commits.twin, page_));
		await expect(shot(before(page, commits.paired))).toBeVisible();
		await expect(shot(after(page, commits.twin))).toBeVisible();
		expect(await fits(page)).toBe(true);
		const name = await file(after(page, commits.twin));
		const open = await request.get(`/harness/media/${name}`);
		expect([open.status(), open.headers()['cache-control']]).toEqual([
			200,
			'private, max-age=31536000, immutable'
		]);
		const locked = await request.get(`http://127.0.0.1:${lockedPort}/harness/media/${name}`, {
			failOnStatusCode: false
		});
		expect(locked.status()).toBe(403);
	});
}
