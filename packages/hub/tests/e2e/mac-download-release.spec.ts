import { expect, test } from '../../../../test/support/browserTest';
import { readFile } from 'node:fs/promises';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';

const path = '/downloads/Harness-mac-arm64.zip';
const synthetic = 'synthetic mac archive';
test.skip(
	process.env.HARNESS_HUB_TEST_MAC_DOWNLOAD !== '1',
	'Uses the dedicated local Workerd R2 fixture.'
);
test.setTimeout(90_000);

test('configured storage streams one vetted archive through the compiled Hub route', async ({
	request
}) => {
	const head = await request.head(path, { maxRedirects: 0 });
	expect(head.status()).toBe(200);
	expect(head.headers()).toMatchObject({
		'content-type': 'application/zip',
		'content-disposition': 'attachment; filename="Harness-mac-arm64.zip"',
		'content-length': String(synthetic.length),
		'cache-control': 'no-store'
	});
	expect(await head.body()).toHaveLength(0);
	const downloaded = await request.get(path, { maxRedirects: 0 });
	expect(downloaded.status()).toBe(200);
	expect(await downloaded.text()).toBe(synthetic);
	for (const refused of [path + '/', path + '?key=other', '/downloads/private.json']) {
		const response = await request.get(refused, { maxRedirects: 0 });
		expect(response.status()).toBe(404);
		expect(response.headers()['content-disposition']).toBeUndefined();
	}
	expect((await request.post(path)).status()).toBe(405);
});

test('the public homepage links to the live compiled download', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	const downloadLink = page.locator('#download').getByRole('link', { name: 'Download for Mac' });
	await expect(downloadLink).toHaveAttribute('href', path, { timeout: 25_000 });
	if (evidenceRequested()) {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			);
		});
		const revision = process.env.HARNESS_VERIFY_REVISION;
		const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
		const buildId = buildStamp(stamp ?? undefined);
		if (!buildId || !revision) throw new Error('The Hub download capture needs a stamped build.');
		recordCapture(
			{
				evidence: 'download-screen',
				kind: 'screenshot',
				state: 'download',
				viewport: 'desktop',
				file: 'hub-mac-download-desktop.png',
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision }
			},
			await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' })
		);
	}
	const pending = page.waitForEvent('download');
	await downloadLink.click();
	const file = await pending;
	expect(file.suggestedFilename()).toBe('Harness-mac-arm64.zip');
	expect(await readFile(await file.path(), 'utf8')).toBe(synthetic);
});
