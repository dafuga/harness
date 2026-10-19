import { expect, test, type Page } from '../../../../test/support/browserTest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { fixtures, seededId } from './support/fixtures';
import { expectRetired, reportView, servedReport } from './support/portableReport';
import { fits, pictured, screens, sharedField, typed } from './support/sharedSelect';

/**
 * The report hub, its filters and the comparison uploader are gone with the report pages. What
 * is left of them is guarded here: the addresses lead into the explorer, every choice of the
 * report viewer is still the one shared select, and the screen size a pair is uploaded for is
 * the one its request names.
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

for (const [screen, width, height] of screens) {
	test(`the screen size of an uploaded pair is the one its request named, shown at ${screen} width`, async ({
		page,
		request,
		baseURL
	}) => {
		const run = await new ReportRepository(fixtures.reports).begin({
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
		await page.setViewportSize({ width, height });
		await page.goto(await servedReport(run.id, baseURL!));
		const card = page.locator('.evidence-card').filter({ hasText: 'Tablet pair' });
		await expect(card).toHaveCount(1);
		await expect(card.first().locator('.evidence-meta')).toContainText('920px tablet');
		await pictured(page, `upload-viewport-kept-${screen}`);
		expect(await fits(page)).toBe(true);
	});

	test(`the fields of the report viewer are the shared select at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(await reportView(await seededId()));
		const speed = combo(page, 'Playback speed');
		await sharedField(speed);
		await typed(page, speed, '16');
		await expect(speed).toHaveValue('16');
		const status = combo(page, 'Status');
		await sharedField(status);
		await pictured(page, `report-shared-before-${screen}`);
		// Chosen by typing how the option begins, and the gallery follows the choice.
		const cards = page.locator('.evidence-grid .evidence-card');
		const all = await cards.count();
		await typed(page, status, 'F');
		await expect(status).toHaveValue('failed');
		await expect.poll(() => cards.count()).toBeLessThan(all);
		await status.selectOption('');
		await expect(cards).toHaveCount(all);
		expect(await fits(page)).toBe(true);
	});
}
