import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	branch,
	commits,
	evidenceData,
	evidenceFixture,
	evidenceState,
	ids,
	sharedProject
} from './ui-evidence-fixture';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { scenarioCapture } from './scenario-capture';

const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const data = evidenceData();
const held = data.results[`${ids.page}|current|${commits.tip}`];
const found = held.evidence.after.captures.find(
	(item) => item.capture.kind === 'screenshot' && item.usable
)!;
const preview = { scenario: found.scenario, state: found.state, viewport: found.capture.viewport! };
const pageTitle = 'Orders page';
const contract = scenarioManifestSchema.parse(
	JSON.parse(
		readFileSync(
			new URL('../../../../specification/scenarios/catalog-previews.json', import.meta.url),
			'utf8'
		)
	)
);

async function capture(page: Page, info: TestInfo, name: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	await scenarioCapture(page, contract, {
		state: name.startsWith('history')
			? 'history-catalog'
			: name.startsWith('missing')
				? 'missing-catalog'
				: name.startsWith('hosted')
					? 'hosted-catalog'
					: 'local-catalog',
		name: 'page-previews',
		note: 'Actual renderer of a sealed synthetic history; the page card shows its recorded screenshot.'
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.PREVIEW_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	await page.screenshot({
		path: join(folder, `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`),
		fullPage: true
	});
}

test('historical cards keep their screenshot and a commit without evidence stays empty', async ({
	page
}, info) => {
	await evidenceFixture(page, { previews: { [ids.page]: preview } });
	await page.goto(`${root}/commit/${commits.middle}/pages`);
	const card = page
		.locator('article.entity-card')
		.filter({ has: page.getByRole('heading', { name: pageTitle, exact: true }) });
	await expect(card.getByRole('img', { name: `Screenshot of ${pageTitle}` })).toBeVisible();
	await expect(card.locator('figcaption')).toContainText(commits.middle.slice(0, 7));
	expect((await evidenceState(page)).calls.find((call) => call.op === 'artifact')).toMatchObject({
		commit: commits.middle,
		mode: 'commit',
		state: preview.state,
		viewport: preview.viewport
	});
	await capture(page, info, 'history-desktop');
	await page.goto(`${root}/commit/${commits.first}/pages`);
	await expect(card.getByRole('status')).toContainText('Screenshot unavailable');
	await expect(card.locator('img')).toHaveCount(0);
	expect((await evidenceState(page)).calls.some((call) => call.op === 'artifact')).toBe(false);
	await capture(page, info, 'missing-desktop');
});

for (const shared of [false, true]) {
	for (const size of [
		{ id: 'desktop', width: 1440, height: 900 },
		{ id: 'tablet', width: 920, height: 1100 },
		{ id: 'mobile', width: 390, height: 844 }
	]) {
		const mode = shared ? 'hosted' : 'local';
		test(`${mode} ${size.id} page cards show the recorded screenshot`, async ({ page }, info) => {
			await page.setViewportSize({ width: size.width, height: size.height });
			await evidenceFixture(page, { shared, previews: { [ids.page]: preview } });
			await page.goto(`${root}/pages`);
			const card = page
				.locator('article.entity-card')
				.filter({ has: page.getByRole('heading', { name: pageTitle, exact: true }) });
			await expect(card.locator('img')).toBeVisible();
			await capture(page, info, `${mode}-${size.id}`);
			await expect(card.getByRole('img', { name: `Screenshot of ${pageTitle}` })).toBeVisible();
			await expect(card).toContainText('Screenshot');
			const calls = (await evidenceState(page)).calls;
			expect(calls.find((call) => call.op === 'artifact')).toMatchObject({
				projectId: sharedProject,
				entityId: ids.page,
				commit: commits.tip,
				scenarioId: preview.scenario,
				state: preview.state,
				viewport: preview.viewport,
				sha256: found.capture.sha256
			});
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
			).toBe(true);
		});
	}
}
