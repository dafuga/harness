import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ReportRepository } from '../../../src/repositories/ReportRepository';
import { ReportExportSerializer } from '../../../src/serializers/ReportExportSerializer';
import { reportRuntimeRoot } from '../../../src/utils/reportRuntimeRoot';
import { fixtures } from './fixtures';
import { reportPdf } from '../../../src/utils/reportPdf';

/** Measure painted icon pixels, since a centered text box can still contain a low font glyph. */
export async function expectCenteredClose(dialog: Locator, info: TestInfo): Promise<void> {
	const close = dialog.getByRole('button', { name: 'Close viewer', exact: true });
	const file = info.outputPath('close-icon.png');
	await close.screenshot({ path: file });
	const measure = `import json,sys
from PIL import Image
image=Image.open(sys.argv[1]).convert('RGB')
points=[(x,y) for y in range(image.height) for x in range(image.width) if min(image.getpixel((x,y)))>180]
assert points, 'Close icon has no visible pixels'
xs,ys=zip(*points)
print(json.dumps([abs((min(xs)+max(xs)+1-image.width)/2),abs((min(ys)+max(ys)+1-image.height)/2)]))`;
	const offsets = JSON.parse(
		execFileSync(reportPdf(), ['-c', measure, file], { encoding: 'utf8', timeout: 5000 })
	) as number[];
	for (const offset of offsets)
		expect(offset, 'Painted close icon center offset').toBeLessThanOrEqual(1);
	await close.click();
	await expect(dialog).toHaveCount(0);
}

/**
 * The address of a report in the viewer that still shows one: the self-contained page an export
 * writes, made here from the report as it stands in its store, active or finalized. It is the
 * compiled viewer of the build under test and the components the removed report page mounted;
 * nothing is served, so it also proves the page needs no server.
 */
export async function portableReport(store: ReportRepository, id: string): Promise<string> {
	const directory = join(fixtures.root, 'portable');
	await mkdir(directory, { recursive: true });
	const serializer = new ReportExportSerializer(reportRuntimeRoot());
	const html = await serializer.html(await store.get(id), store.directory(id));
	const file = join(directory, `${id}.html`);
	await writeFile(file, html, { mode: 0o600 });
	return pathToFileURL(file).toString();
}

/**
 * The viewer of a report whose media is read from the report API of the application under test
 * instead of being inlined. It keeps the path of a registered asset through the API guarded:
 * what the viewer does when that path fails, and that the original bytes are still served.
 */
export async function servedReport(id: string, origin: string): Promise<string> {
	const store = new ReportRepository(fixtures.reports);
	const report = structuredClone(await store.get(id));
	for (const item of report.evidence.filter((entry) => !entry.missing)) {
		item.file = `${origin}/api/reports/${id}/assets/${item.file}`;
	}
	const directory = join(fixtures.root, 'portable');
	await mkdir(directory, { recursive: true });
	const file = join(directory, `${id}-served.html`);
	const serializer = new ReportExportSerializer(reportRuntimeRoot());
	await writeFile(file, await serializer.page(report), { mode: 0o600 });
	return pathToFileURL(file).toString();
}

/** The viewer address of a report in the store of this run, by its id. */
export const reportView = (id: string): Promise<string> =>
	portableReport(new ReportRepository(fixtures.reports), id);

const moved = [301, 302, 303, 307, 308];

/**
 * Proves that an address of the removed report and analytics screens is answered by a redirect
 * into the explorer, and that following it shows the explorer and none of the removed screens.
 */
export async function expectRetired(page: Page, path: string): Promise<void> {
	const answer = await page.request.get(path, { maxRedirects: 0 });
	expect(moved, `${path} answers ${answer.status()}`).toContain(answer.status());
	expect(answer.headers().location).toMatch(/^\/harness(\/|$)/);
	await page.goto(path);
	await expect(page).toHaveURL(/\/harness\/branch\/[^/]+\/(commit\/[0-9a-f]{40}\/)?pages$/);
	await expect(page.getByRole('navigation', { name: 'Harness categories' })).toBeVisible();
	await expect(page.locator('.run-card, .evidence-grid, .upload-form')).toHaveCount(0);
}

export async function capture(page: Page, name: string, fullPage = true) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = `output/evidence/${process.env.SCREENSHOT_LABEL || 'current'}`;
	await mkdir(directory, { recursive: true });
	await page.evaluate(async () => {
		await document.fonts.ready;
		for (const image of document.querySelectorAll('img')) {
			const bounds = image.getBoundingClientRect();
			if (bounds.width === 0 || bounds.height === 0) continue;
			await image.decode();
			if (!image.complete || image.naturalWidth === 0) throw new Error('Image is not ready');
		}
	});
	await page.screenshot({ path: `${directory}/${name}.png`, fullPage });
}
