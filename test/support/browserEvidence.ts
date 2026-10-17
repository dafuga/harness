import type { Page } from '@playwright/test';
import { BuildIdentityService } from '../../src/services/BuildIdentityService';
import { buildStamp } from '../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../src/utils/recordCapture';

/** The diagnostic viewer's real pixels over synthetic records, bound to the compiled viewer. */
export async function browserEvidence(page: Page, shown: { state: string; home?: string }) {
	if (!evidenceRequested() || process.env.HARNESS_SCENARIO !== 'browser-error-evidence') return;
	await page.evaluate(() => globalThis.document.fonts.ready);
	const buildId = await viewerBuild(page, shown.home);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!buildId || !/^[a-f0-9]{40}$/.test(revision ?? ''))
		throw new Error('Missing viewer build identity');
	const viewport = page.viewportSize()?.width === 390 ? 'mobile' : 'desktop';
	recordCapture(
		{
			evidence: shown.state === 'desktop' ? 'desktop-screens' : 'screens',
			kind: 'screenshot',
			state: shown.state,
			viewport,
			file: `browser-errors-${shown.state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision: revision! },
			note: 'Actual component viewer over synthetic recorded errors; fixture history is not a real project run.'
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}

async function viewerBuild(page: Page, home?: string) {
	return home
		? (await new BuildIdentityService().identify(home))?.buildId
		: buildStamp(
				(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
			);
}
