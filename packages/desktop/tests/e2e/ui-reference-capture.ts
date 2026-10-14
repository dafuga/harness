import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../../../src/utils/recordCapture';
import scenario from '../../../../specification/scenarios/agent-references.json' with { type: 'json' };

export { scenario };

/** A screenshot of the compiled renderer as evidence of one state of agent-references. */
async function recorded(page: Page, state: string) {
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size?.height
	);
	const meta = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(meta ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!viewport || !buildId || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('Compiled scenario identity is missing');
	recordCapture(
		{
			...{ evidence: `references-${state}`, kind: 'screenshot', state, viewport: viewport.id },
			...{ file: `references-${state}-${viewport.id}.png`, mediaType: 'image/png' },
			provenance: 'actual-capture',
			server: { buildId, revision },
			note: 'Actual workspace over SYNTHETIC projects and injected run events. No live agent run claimed.'
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}

/**
 * Every image that is laid out and has a source has loaded with pixels and decodes; a failed
 * decode fails the capture. Then the fonts are ready.
 */
async function ready(page: Page) {
	await page.waitForFunction(() =>
		[...document.images]
			.filter((image) => (image.currentSrc || image.src) && image.getClientRects().length > 0)
			.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
	);
	await page.evaluate(async () => {
		const shown = [...document.images].filter(
			(image) => (image.currentSrc || image.src) && image.getClientRects().length > 0
		);
		await Promise.all(shown.map((image) => image.decode()));
		await document.fonts.ready;
	});
}

/**
 * Keeps a screenshot of a state once its checks passed and its images and fonts are ready: as
 * scenario evidence when verification asks for it, and as a rehearsal file outside the source
 * tree when TAKE_SCREENSHOT is true.
 */
export async function capture(page: Page, info: TestInfo, state: string) {
	await ready(page);
	if (evidenceRequested()) await recorded(page, state);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.REFERENCE_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const label = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${state}-${page.viewportSize()?.width}`;
	await page.screenshot({
		path: join(folder, `${label}.png`),
		fullPage: true,
		animations: 'disabled'
	});
}
