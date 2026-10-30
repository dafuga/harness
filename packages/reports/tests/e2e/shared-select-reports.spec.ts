import { expect, test, type Page } from '../../../../test/support/browserTest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { fixtures, seededId } from './support/fixtures';
import { expectRetired } from './support/retiredAddress';
import { screens } from './support/sharedSelect';

/**
 * The report hub, its filters and the comparison uploader are gone with the report pages. What
 * is left of them is guarded here: the addresses lead into the explorer, and the screen size a
 * pair is uploaded for is the one its request names.
 */
const combo = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });

test('the report hub and its filters are gone: their addresses lead into the explorer', async ({
	page
}) => {
	await expectRetired(page, '/harness/reports');
	await expect(combo(page, 'Report mode')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Search reports' })).toHaveCount(0);
	await expectRetired(page, `/harness/reports/${await seededId()}`);
	await expect(page.getByText('Add before/after comparison', { exact: true })).toHaveCount(0);
});

for (const [screen] of screens) {
	test(`the screen size of an uploaded pair is the one its request named, at ${screen} width`, async ({
		request,
		baseURL
	}) => {
		const store = new ReportRepository(fixtures.reports);
		const run = await store.begin({
			project: fixtures.site('alpha-project'),
			title: `Shared select upload at ${screen} width`,
			mode: 'feature',
			environment: 'local fixture'
		});
		const image = await readFile(join(fixtures.reports, 'fixture.png'));
		const pair = (viewport: string) =>
			request.post('/api/report-screenshot-upload', {
				headers: { Origin: baseURL! },
				multipart: {
					reportId: run.id,
					title: 'Tablet pair',
					viewport,
					before: { name: 'before.png', mimeType: 'image/png', buffer: image },
					after: { name: 'after.png', mimeType: 'image/png', buffer: image }
				}
			});
		// A size the uploader never offered is refused, and nothing is added for it.
		expect((await pair('watch')).status()).toBe(400);
		expect((await pair('tablet')).status()).toBe(201);
		const stored = await store.get(run.id);
		expect(stored.evidence.map((item) => item.viewport)).toEqual(['920px tablet', '920px tablet']);
	});
}
