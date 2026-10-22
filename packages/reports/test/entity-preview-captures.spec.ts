import { expect, test } from '../../../test/support/browserTest';
import { capture, open, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gatherCaptures } from '../../../src/services/check-run-service/gatherCaptures';
import { BuildIdentityService } from '../../../src/services/BuildIdentityService';
import { benchmarkCaptureSchema } from '../../../src/core/verification-evidence/verifyTypes';
import { previewHome } from './entityPreviewSetup';

const page = { category: 'pages' as const, entity: ids.page };
const shots = '.ex-evidence .ex-shot img';

test('preview captures retain decoded pixels and measured workloads with their served identity', async ({
	page: tab
}) => {
	const directory = mkdtempSync(join(tmpdir(), 'harness-preview-capture-'));
	const previous = { ...process.env };
	try {
		process.env.TAKE_SCREENSHOT = '1';
		process.env.HARNESS_EVIDENCE_DIR = directory;
		await open(tab, page);
		await capture(tab, 'page-current-desktop');
		const { gathered, failures } = gatherCaptures(directory, 'evidence');
		expect(failures).toEqual([]);
		expect(gathered, 'preview captures enter the durable Harness protocol').toHaveLength(2);
		const screenshot = gathered.find(({ line }) => line.kind === 'screenshot')!;
		const built = await new BuildIdentityService().identify(previewHome());
		expect(screenshot.line).toMatchObject({
			evidence: 'reports.component.harness-explorer-content',
			state: 'page-current-desktop',
			viewport: 'desktop',
			provenance: 'actual-capture',
			server: {
				buildId: built!.buildId,
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		});
		expect(screenshot.facts).toMatchObject({ kind: 'image', width: 1440 });
		const metrics = gathered.find(({ line }) => line.kind === 'benchmark')!;
		const rows = benchmarkCaptureSchema.parse(metrics.benchmark).measurements;
		expect(rows.map(({ metric }) => metric).sort()).toEqual([
			'browser-js-heap-bytes',
			'browser-navigation-ms'
		]);
		for (const row of rows) {
			expect(row.unit).toBe(screenshot.line.evidence);
			expect(row.value).toBeGreaterThan(0);
			expect(row.samples).toBe(1);
			expect(row.method).toMatch(/whole (?:fixture|page)/i);
			expect(row.workload).toBe('page-current-desktop-1440x900');
		}
	} finally {
		for (const key of ['TAKE_SCREENSHOT', 'HARNESS_EVIDENCE_DIR']) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
		rmSync(directory, { recursive: true, force: true });
	}
});

test('screenshots use their capture commit and comparisons show their paired revisions', async ({
	page: tab
}) => {
	await open(tab, page);
	await expect(tab.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await expect(tab.locator(shots)).toHaveCount(1);
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-desktop.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toContainText('ccccccc');
	await expect(tab.locator('.ex-pane figcaption strong')).not.toContainText('Branch tip');
	await capture(tab, 'page-current-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-mobile.png');
	await expect(tab.getByRole('combobox', { name: 'State' })).toHaveCount(0);
	await open(tab, { category: 'components', entity: ids.card }, 'inherited');
	await expect(tab.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await ready(tab);
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/bbbbbbb-default-desktop.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toHaveText('bbbbbbb');
	await capture(tab, 'component-current-inherited-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/bbbbbbb-default-mobile.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toHaveText('bbbbbbb');
	await capture(tab, 'component-current-inherited-mobile');
	await open(tab, { ...page, commit: commits.middle });
	await expect(tab.getByRole('heading', { name: 'Commit comparison' })).toBeVisible();
	const sources = () =>
		tab.locator(shots).evaluateAll((all) => all.map((image) => image.getAttribute('src')));
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-desktop.png',
		'/media/bbbbbbb-default-desktop.png'
	]);
	await capture(tab, 'page-commit-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-mobile.png',
		'/media/bbbbbbb-default-mobile.png'
	]);
	const image = tab.locator('.ex-evidence .ex-shot').last();
	await image.click();
	await expect(tab.getByRole('dialog')).toBeVisible();
	await tab.keyboard.press('Escape');
	await expect(tab.getByRole('dialog')).toHaveCount(0);
	await image.focus();
	await image.press('Enter');
	await expect(tab.getByRole('dialog')).toBeVisible();
});
