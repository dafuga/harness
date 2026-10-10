import { expect, test } from '@playwright/test';
import { brief, seeded, short } from './support/harnessHistory';

const { commits } = seeded();

test('earlier reports keep their outcome, date and the revision they recorded', async ({
	page
}) => {
	await page.goto(`/harness?view=history&commit=${commits.reordered}`);
	const earlier = page.getByRole('region', { name: 'Earlier reports' });
	const reports = earlier.getByRole('list', { name: 'Earlier reports' }).getByRole('listitem');
	await expect(reports).toHaveCount(2);
	const linked = reports.filter({ hasText: 'Uppercase titles' });
	await expect(linked).toContainText('Passed');
	await expect(linked).toContainText('2026-10-07');
	await expect(linked).toContainText(`Recorded for ${short(commits.shout)}`);
	const unlinked = reports.filter({ hasText: 'Exploration without a revision' });
	await expect(unlinked).toContainText('Running');
	await expect(unlinked).toContainText('no tested revision was recorded');
	await expect(unlinked.getByRole('button', { name: /^Show commit/ })).toHaveCount(0);

	// Its screenshot is shown through the same gallery, as a legacy capture and nothing more.
	await linked.getByRole('button', { name: 'Show its evidence' }).click();
	const card = earlier.locator('.evidence-card');
	await expect(card).toHaveCount(1);
	await expect(card).toContainText('Legacy report capture');
	await expect(card).toContainText('not recorded: legacy reports name no build');
	await expect(card).toContainText(
		`legacy report linked-run, recorded for ${brief(commits.shout)}`
	);
	await expect(card).not.toContainText('Tested at');
	const image = card.locator('img');
	await expect(image).toHaveJSProperty('complete', true);
	expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(4);

	await linked.getByRole('button', { name: `Show commit ${short(commits.shout)}` }).click();
	await expect(page.getByRole('combobox', { name: 'Commit' })).toHaveValue(commits.shout);
	const now = page.getByRole('region', { name: 'Earlier reports' });
	await expect(now.getByRole('listitem').filter({ hasText: 'Uppercase titles' })).toContainText(
		'Recorded for this commit'
	);
});
