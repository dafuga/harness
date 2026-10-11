import { expect, test } from '@playwright/test';
import { revision, seeded } from './support/harnessHistory';

const { commits } = seeded();
const branch = '/harness/branch/feature/kept%231';

test('reasons that differ only in the file they are about are all shown, in every view', async ({
	page
}) => {
	// The fixture commit changed two files of one unit for one reason.
	const detail = revision(commits.twin) as unknown as {
		explanations: Array<{ unit: string; symbol: string; behavior: string; file?: string }>;
	};
	const paired = detail.explanations.filter((reason) => reason.unit === 'page.titles');
	const same = paired.filter(
		(reason) => reason.symbol === paired[0].symbol && reason.behavior === paired[0].behavior
	);
	expect(same.length).toBeGreaterThanOrEqual(2);

	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	await page.goto(`${branch}/commit/${commits.twin}/compare/${commits.paired}`);
	const impact = page.getByRole('region', { name: 'Impact' });
	await expect(impact.getByRole('list', { name: 'Directly changed' })).toContainText('page.titles');
	const reasons = impact.getByRole('list', { name: 'Reasons' }).getByRole('listitem');
	await expect(reasons.filter({ hasText: 'page.titles' })).toHaveCount(paired.length);

	await page.goto(`${branch}/commit/${commits.twin}/growth/unit/page.titles`);
	await expect(page.getByRole('table', { name: 'Growth of page.titles' })).toBeVisible();
	await page.goto(`${branch}/commit/${commits.twin}/history`);
	await expect(page.getByRole('region', { name: 'Recorded verification' })).toBeVisible();
	expect(errors).toEqual([]);
});
