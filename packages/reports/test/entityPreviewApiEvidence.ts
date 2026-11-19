import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import scenario from '../../../specification/scenarios/explorer-apis.json' with { type: 'json' };
import { captureIndex, captureLineSchema } from '../../../src/core/verifyTypes';
import { recordCapture } from '../../../src/utils/reports-media/record-capture/recordCapture';
import { mediaFacts } from '../../../src/utils/verification-evidence/mediaFacts';

const evidence = scenario.evidence.find((entry) => entry.id === 'api-screens')!;

/** Register the same full-page pixels as the named screenshot of the explorer-apis scenario. */
export function recordApiScreen(
	state: string,
	viewport: string,
	server: { buildId: string; revision: string } | undefined,
	pixels: Buffer
) {
	if (!evidence.states.includes(state) || !evidence.viewports.includes(viewport))
		throw new Error(`explorer-apis does not declare the capture ${state} at ${viewport}.`);
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state,
			viewport,
			file: `${evidence.id}-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server,
			note: 'Real full-page capture of the shared explorer over a synthetic history.'
		},
		pixels
	);
}

export function validateApiScreens() {
	const directory = process.env.HARNESS_EVIDENCE_DIR!;
	const revision = process.env.HARNESS_VERIFY_REVISION;
	const screenshots = readFileSync(join(directory, captureIndex), 'utf8')
		.trim()
		.split('\n')
		.map((line) => captureLineSchema.parse(JSON.parse(line)))
		.filter((line) => line.kind === 'screenshot' || line.evidence === evidence.id);
	const expected = evidence.states.flatMap((state) =>
		evidence.viewports.map((viewport) => `${evidence.id}/${state}/${viewport}`)
	);
	expect(
		screenshots.map((shot) => `${shot.evidence}/${shot.state}/${shot.viewport}`).sort()
	).toEqual(expected.sort());
	expect(revision).toMatch(/^[0-9a-f]{40}$/);
	expect(new Set(screenshots.map((shot) => shot.server?.buildId)).size).toBe(1);
	for (const shot of screenshots) {
		const viewport = scenario.viewports.find((entry) => entry.id === shot.viewport)!;
		const image = mediaFacts(readFileSync(join(directory, shot.file)), shot.mediaType);
		expect(shot).toMatchObject({
			kind: 'screenshot',
			provenance: 'actual-capture',
			server: { revision }
		});
		expect(image).toMatchObject({ kind: 'image', width: viewport.width });
		if ('height' in image) expect(image.height).toBeGreaterThanOrEqual(viewport.height);
	}
}
