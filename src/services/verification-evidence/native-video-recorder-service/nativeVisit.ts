// @harness-uid u_akqk4uwm6b
import type { Page } from '@playwright/test';
import type { NativeCapture } from '../NativeVideoRecorderService.types';
import { recordingFailure } from './nativeFiles';

/** Hold script advancement until a sampled native frame can contain the asserted painted state. */
export async function nativeVisit(
	page: Page,
	frames: NativeCapture['frames'],
	kind: 'trigger' | 'state' | 'edge',
	id: string
): Promise<NativeCapture['events'][number]> {
	const timestamp = await page.evaluate(() => performance.timeOrigin + performance.now());
	if (kind === 'trigger') return { kind, id, timestamp };
	const paintAfter = await page.evaluate(
		() =>
			new Promise<number>((resolve) =>
				globalThis.requestAnimationFrame(() => {
					const beforePaint = performance.timeOrigin + performance.now();
					globalThis.requestAnimationFrame(() => resolve(beforePaint));
				})
			)
	);
	let acquired = frames.find((frame) => frame.timestamp >= paintAfter);
	for (let attempt = 0; !acquired && attempt < 20; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		acquired = frames.find((frame) => frame.timestamp >= paintAfter);
	}
	const source = acquired ?? frames.at(-1);
	if (!source) recordingFailure('No acquired frame can represent the visible assertion.');
	// Every canonical 30 Hz sample lies within this hold. Animation clocks keep advancing.
	await page.waitForTimeout(40);
	return {
		kind,
		id,
		timestamp,
		sourceTimestamp: source.timestamp,
		paint: acquired ? 'native-frame' : 'held-static-frame'
	};
}
