import { expect, test, type Locator, type Page } from '@playwright/test';
import { brief, revision, seeded, short } from './support/harnessHistory';

const { commits } = seeded();
const screenshots = (page: Page) => page.locator('.evidence-card:not(.audio-card)');
const clips = (page: Page) => page.locator('.audio-card');
const unrecorded = 'not recorded: the capture names no build or revision';

/** The record of a commit with a matching failure, or its passing record when none is asked for. */
function recordOf(commit: string, failure?: RegExp) {
	const found = revision(commit).records.find((record) =>
		failure ? record.failures.some((text) => failure.test(text)) : record.status === 'passed'
	);
	if (!found) throw new Error(`the seeded history has no such record at ${commit}`);
	return found;
}

async function openRecord(page: Page, commit: string, id: string) {
	await page.goto(`/harness?view=history&commit=${commit}`);
	await page
		.getByRole('list', { name: 'Verification records' })
		.getByRole('button', { name: `Record ${brief(id)}` })
		.click();
	await expect(
		page.getByRole('heading', { name: `Scenarios of record ${brief(id)}` })
	).toBeVisible();
}

async function zoom(page: Page, title: string, viewport: string): Promise<Locator> {
	await screenshots(page)
		.filter({ hasText: title })
		.filter({ hasText: viewport })
		.getByRole('button', { name: `Open ${title}` })
		.click();
	return page.getByRole('dialog');
}

/** What every view of the stale record must say: gallery, zoom and the portable export alike. */
async function expectStale(page: Page, record: string) {
	await expect(screenshots(page)).toHaveCount(6);
	for (const card of await screenshots(page).all()) {
		await expect(card).toContainText('Rejected capture from another revision');
		await expect(card).toContainText(`build fixture-build of ${brief(commits.baseline)}`);
		await expect(card).toContainText(
			`record ${brief(record)} (failed) targeting ${brief(commits.reordered)}`
		);
		await expect(card).toContainText('Failed');
		await expect(card).not.toContainText('Tested at');
	}
	const viewer = await zoom(page, 'titles-page · empty', '1440px desktop');
	await expect(viewer).toContainText('Rejected capture');
	await expect(viewer).toContainText(
		`Captured from build fixture-build of revision ${commits.baseline}.`
	);
	await expect(viewer).toContainText(`targeted revision ${commits.reordered}`);
	await expect(viewer).not.toContainText('Current');
	await expect(viewer).not.toContainText('Tested at');
}

test('a rejected stale capture names the build that produced it, never the target as tested', async ({
	page
}) => {
	const record = recordOf(commits.reordered, /was produced by revision/);
	await openRecord(page, commits.reordered, record.id);
	const scenario = page
		.getByRole('list', { name: 'Scenarios' })
		.getByRole('listitem')
		.filter({ hasText: 'titles-page' });
	await expect(scenario).toContainText(`Failed attempt at ${short(commits.reordered)}`);
	await expect(scenario).toContainText(`captures came from ${short(commits.baseline)}`);
	await expect(scenario).not.toContainText('Tested at');
	await expectStale(page, record.id);
});

test('the portable export keeps the same per-capture provenance', async ({ page }) => {
	const record = recordOf(commits.reordered, /was produced by revision/);
	const download = await page.request.get(
		`/harness/export/${commits.reordered}?record=${record.id}`
	);
	expect(download.status()).toBe(200);
	await page.setContent(await download.text());
	await expectStale(page, record.id);
});

test('fresh captures name the tested build, and a capture without a build stamp claims none', async ({
	page
}) => {
	const record = recordOf(commits.reordered);
	await openRecord(page, commits.reordered, record.id);
	const attempt = `record ${brief(record.id)} (passed) targeting ${brief(commits.reordered)}`;
	await expect(screenshots(page)).toHaveCount(6);
	for (const card of await screenshots(page).all()) {
		await expect(card).toContainText('Fresh capture');
		await expect(card).toContainText(`build fixture-build of ${brief(commits.reordered)}`);
		await expect(card).toContainText(attempt);
	}
	const viewer = await zoom(page, 'titles-page · filled', '390px mobile');
	await expect(viewer).toContainText('Fresh capture');
	await expect(viewer).toContainText(
		`Captured from build fixture-build of revision ${commits.reordered}.`
	);
	await expect(viewer).not.toContainText('Current');
	await page.keyboard.press('Escape');

	await expect(clips(page)).toHaveCount(1);
	await expect(clips(page)).toContainText('Fresh capture');
	await expect(clips(page)).toContainText(unrecorded);
	await expect(clips(page)).toContainText('fixture data, not a capture of running software');
	await expect(clips(page)).toContainText(attempt);
	await expect(clips(page)).not.toContainText('Tested at');
	await expect(clips(page)).not.toContainText('Current');
});

test('inherited evidence keeps the record, revision and build that originally produced it', async ({
	page
}) => {
	const record = recordOf(commits.retained);
	const origin = (id: string) => {
		const scenario = record.scenarios.find((item) => item.id === id);
		expect([id, scenario?.inherited]).toEqual([id, true]);
		return scenario?.origin ?? { record: '', commit: '' };
	};
	const pages = origin('titles-page');
	expect(pages.commit).not.toBe(commits.retained);
	await openRecord(page, commits.retained, record.id);
	const attempt = `record ${brief(record.id)} (passed) targeting ${brief(commits.retained)}`;
	await expect(screenshots(page)).toHaveCount(6);
	for (const card of await screenshots(page).all()) {
		await expect(card).toContainText('Inherited capture');
		await expect(card).toContainText(`build fixture-build of ${brief(pages.commit)}`);
		await expect(card).toContainText(`record ${brief(pages.record)} of ${brief(pages.commit)}`);
		await expect(card).toContainText(attempt);
	}
	const viewer = await zoom(page, 'titles-page · empty', '920px tablet');
	await expect(viewer).toContainText('Inherited capture');
	await expect(viewer).toContainText(
		`Captured from build fixture-build of revision ${pages.commit}.`
	);
	await expect(viewer).toContainText(`not captured again for revision ${commits.retained}`);
	await expect(viewer).not.toContainText('Current');
	await expect(viewer).not.toContainText('Tested at');
	await page.keyboard.press('Escape');

	const spoken = origin('titles-audio');
	await expect(clips(page)).toContainText('Inherited capture');
	await expect(clips(page)).toContainText(
		`record ${brief(spoken.record)} of ${brief(spoken.commit)}`
	);
	await expect(clips(page)).toContainText(unrecorded);
});

test('captures with no recorded build and rejected audio stay visible and read as rejected', async ({
	page
}) => {
	const unstamped = recordOf(commits.restated, /has no build stamp/);
	await openRecord(page, commits.restated, unstamped.id);
	await expect(screenshots(page)).toHaveCount(6);
	for (const card of await screenshots(page).all()) {
		await expect(card).toContainText('Rejected capture with no recorded build');
		await expect(card).toContainText(unrecorded);
		await expect(card).toContainText(
			`record ${brief(unstamped.id)} (failed) targeting ${brief(commits.restated)}`
		);
		await expect(card).not.toContainText('Tested at');
	}
	const viewer = await zoom(page, 'titles-page · filled', '1440px desktop');
	await expect(viewer).toContainText('The capture does not record which build or revision');
	await expect(viewer).toContainText(`targeted revision ${commits.restated}`);
	await expect(viewer).not.toContainText('Current');

	const silent = recordOf(commits.restated, /has no transcript/);
	await openRecord(page, commits.restated, silent.id);
	const attempt = `record ${brief(silent.id)} (failed) targeting ${brief(commits.restated)}`;
	await expect(clips(page)).toHaveCount(1);
	await expect(clips(page)).toContainText('Rejected capture');
	await expect(clips(page)).toContainText('Failed');
	await expect(clips(page)).toContainText(attempt);
	await expect(clips(page)).not.toContainText('Current');
	await expect(clips(page)).not.toContainText('Synthetic test tone');
	await expect(clips(page).locator('audio')).toHaveCount(1);
	// Its screenshots were accepted on their own, yet the attempt they belong to failed.
	await expect(screenshots(page)).toHaveCount(6);
	for (const card of await screenshots(page).all()) {
		await expect(card).toContainText('Fresh capture');
		await expect(card).toContainText(`build fixture-build of ${brief(commits.restated)}`);
		await expect(card).toContainText(attempt);
	}
});
