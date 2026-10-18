import { createHash } from 'node:crypto';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenarioData from '../../../../specification/scenarios/runtime-evidence-ui.json' with { type: 'json' };
import { buildStamp } from '../../../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../../../src/utils/recordCapture';
import { evidencePlayed, recordedClip } from './ui-evidence-fixture';

const scenario: ScenarioManifest = scenarioData as ScenarioManifest;
const note =
	'Actual renderer over SYNTHETIC orders, history, record IDs, hashes and clips. Only the outer build and revision identify tested software; fixture history is not real sealed evidence.';

/** Wait for final pixels before either smoke or verification captures. */
async function settled(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			[...document.images].map(async (image) => {
				await image.decode();
				if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
					throw new Error(`Image not ready: ${image.alt}`);
			})
		);
	});
	await page.mouse.move(0, 0);
}

async function provenance(page: Page) {
	const buildId = buildStamp(
		(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
	);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!buildId) throw new Error('The rendered build has no compiled identity stamp');
	if (process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision ?? ''))
		throw new Error(
			'A verification revision is required; fixture commits cannot identify the renderer'
		);
	return { buildId, revision: revision! };
}

/** Record required scenario evidence, or an explicitly opted-in unsealed local smoke PNG. */
export async function runtimeEvidence(page: Page, info: TestInfo, state: string): Promise<void> {
	const requested = evidenceRequested();
	if (!requested && process.env.TAKE_SCREENSHOT !== 'true') return;
	await settled(page);
	if (!requested) {
		await page.screenshot({
			path: info.outputPath(`runtime-smoke-${state}-${page.viewportSize()?.width}.png`),
			fullPage: true,
			animations: 'disabled',
			caret: 'hide'
		});
		return;
	}
	const server = await provenance(page);
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size?.height
	)?.id;
	if (!viewport) throw new Error('The capture viewport is not declared by runtime-evidence-ui');
	const evidence = scenario.evidence.find(
		(item) =>
			item.kind === 'screenshot' && item.viewports.includes(viewport) && item.states.includes(state)
	);
	if (!evidence) throw new Error(`The capture state ${state} is not declared for ${viewport}`);
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state,
			viewport,
			file: `runtime-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server,
			note
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}

/** Keep the exact playable fixture bytes, with an honest transcript of their silent content. */
export async function runtimeAudio(page: Page): Promise<void> {
	if (!evidenceRequested()) return;
	const server = await provenance(page);
	const bytes = Uint8Array.from(await evidencePlayed(page.locator('audio')));
	// The transcript below is true of the recorded clip alone: no other bytes are kept under it.
	if (createHash('sha256').update(bytes).digest('hex') !== recordedClip())
		throw new Error('The clip the page plays does not have the recorded SHA-256');
	recordCapture(
		{
			evidence: 'runtime-audio-fixture',
			kind: 'audio',
			state: 'audio-current',
			file: 'runtime-silent-fixture.wav',
			mediaType: 'audio/wav',
			provenance: 'fixture',
			server,
			transcript:
				'[One second of silence. The displayed "Order filed." transcript is synthetic fixture metadata, not audible speech.]',
			note
		},
		bytes
	);
}

/** Component captures stay above all sections, including Source, without re-reading bytes. */
export async function componentScreens(page: Page, info: TestInfo, phase: string): Promise<void> {
	const tabs = page.getByRole('navigation', { name: 'Entity sections' });
	const panel = page.getByRole('region', { name: 'Recorded runtime evidence', exact: true });
	const sources = await panel
		.getByRole('img')
		.evaluateAll((images) => images.map((image) => image.getAttribute('src')));
	for (const name of ['Overview', 'Designs', 'Used In', 'Uses', 'States', 'History', 'Source']) {
		await tabs.getByRole('button', { name, exact: true }).click();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await settled(page);
			await page.screenshot({
				path: info.outputPath(`header-${phase}-${name}.png`),
				fullPage: true
			});
		}
		await expect(panel, 'component screenshot persists across tabs').toHaveCount(1);
		const shot = (await panel.boundingBox())!;
		expect(shot.y + shot.height, 'component screenshot stays above its tabs').toBeLessThanOrEqual(
			(await tabs.boundingBox())!.y
		);
		expect(
			await panel
				.getByRole('img')
				.evaluateAll((images) => images.map((image) => image.getAttribute('src')))
		).toEqual(sources);
	}
	await tabs.getByRole('button', { name: 'Overview', exact: true }).click();
}
