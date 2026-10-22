import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';
import { home } from './harnessHistory';
import { pageBenchmark, pageUnit } from './pageBenchmark';

export const viewports = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
] as const;
export type Viewport = (typeof viewports)[number];

// Kept only by a run with TAKE_SCREENSHOT=true and a before or after label; fonts and images wait.
export async function capturePhase(page: Page, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const label = process.env.SCREENSHOT_LABEL;
	if (label !== 'before' && label !== 'after') throw new Error('SCREENSHOT_LABEL: before or after');
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	const folder = process.env.HARNESS_EXPLORER_SHOTS ?? test.info().outputDir;
	await page.screenshot({ path: `${folder}/${label}-${name}.png`, fullPage: true });
}

/**
 * Outside `harness verify` no revision is being verified, so the built server is told this
 * placeholder: the capture protocol is still exercised, and nothing claims a real commit.
 */
export const unverifiedRevision = '0'.repeat(40);
export const revision = process.env.HARNESS_VERIFY_REVISION ?? unverifiedRevision;
/** Where captures go: the verification's evidence directory, or scratch for an ordinary run. */
export const evidenceDirectory = process.env.HARNESS_EVIDENCE_DIR ?? join(home, 'evidence');
/**
 * The evidence directory of another scenario: a verification gives each check its own, and an
 * ordinary run keeps the scenarios apart by name.
 */
export const evidenceOf = (scenario: string) =>
	process.env.HARNESS_EVIDENCE_DIR ?? join(home, `evidence-${scenario}`);
const requested = (directory: string) => ({
	HARNESS_EVIDENCE_DIR: directory,
	TAKE_SCREENSHOT: '1'
});

/** Call after the state-specific UI assertion; wait for its fonts, decoded images and paint. */
export async function settled(page: Page): Promise<void> {
	await page.waitForLoadState('domcontentloaded');
	const broken = await page.evaluate(async () => {
		await document.fonts.ready;
		const images = [...document.images];
		// A lazy image outside the viewport never loads by itself, and decode() would never settle.
		for (const image of images) image.loading = 'eager';
		const loaded = (image: HTMLImageElement) =>
			new Promise<void>((resolve) => {
				if (image.complete) return resolve();
				image.addEventListener('load', () => resolve(), { once: true });
				image.addEventListener('error', () => resolve(), { once: true });
				setTimeout(resolve, 5_000);
			});
		const failures = await Promise.all(
			images.map(async (image) => {
				await loaded(image);
				const source = image.currentSrc || image.src;
				if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return source;
				try {
					await image.decode();
					return null;
				} catch {
					return source;
				}
			})
		);
		// One frame for layout after the last image, one more for canvas and SVG painting.
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
		return failures.filter((source) => source !== null);
	});
	expect(broken).toEqual([]);
}

/** The build and revision the server under test reports about itself. */
export async function servedBuild(
	page: Page
): Promise<{ buildId: string; revision: string } | undefined> {
	const health = (await (await page.request.get('/api/health')).json()) as {
		buildId?: string;
		revision?: string | null;
	};
	return health.buildId && health.revision
		? { buildId: health.buildId, revision: health.revision }
		: undefined;
}

function keep(file: string, bytes: Buffer): void {
	const directory = process.env.HARNESS_CAPTURE_DIR;
	if (!directory) return;
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, file), bytes);
}

/** Captures exactly the viewport of a settled page and records it under the capture protocol. */
export async function captureScreen(
	page: Page,
	state: string,
	viewport: Viewport,
	destination: string | { directory: string; evidence: string } = evidenceDirectory
): Promise<void> {
	const directory = typeof destination === 'string' ? destination : destination.directory;
	await settled(page);
	const bytes = await page.screenshot({
		animations: 'disabled',
		caret: 'hide'
	});
	const file = `${state}-${viewport.id}.png`;
	const server = await servedBuild(page);
	const stamp = server ? { server } : {};
	recordCapture(
		{
			evidence: 'screens',
			kind: 'screenshot',
			state,
			viewport: viewport.id,
			file,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			...stamp
		},
		bytes,
		requested(directory)
	);
	keep(file, bytes);
	if (directory === evidenceDirectory)
		await pageBenchmark(page, `${state}-${viewport.id}`, pageUnit(page.url()));
}

/**
 * Plays a clip to its end in the page's own player, then records the bytes the player was
 * served together with the duration the browser decoded and the transcript the page shows.
 */
export async function captureAudio(
	page: Page,
	state: string,
	player: Locator,
	directory = evidenceDirectory
): Promise<number> {
	const media = (run: (element: HTMLAudioElement) => unknown) =>
		player.evaluate(run as (element: HTMLElement | SVGElement) => unknown);
	await media((element) => element.play());
	// A clip may be longer than the default wait; it has to play to its real end.
	await expect.poll(() => media((element) => element.ended), { timeout: 30_000 }).toBe(true);
	const durationSeconds = (await media((element) => element.duration)) as number;
	const response = await page.request.get((await media((element) => element.currentSrc)) as string);
	const transcript = await page.locator('.audio-transcript:visible').first().innerText();
	const server = await servedBuild(page);
	const bytes = await response.body();
	recordCapture(
		{
			evidence: 'tone',
			kind: 'audio',
			state,
			file: `${state}.wav`,
			mediaType: 'audio/wav',
			provenance: 'actual-capture',
			transcript,
			durationSeconds,
			note: 'The bytes the console served to its player; the clip itself is a generated tone.',
			...(server ? { server } : {})
		},
		bytes,
		requested(directory)
	);
	keep(`${state}.wav`, bytes);
	return durationSeconds;
}

/** Every visible tab of the real route keeps its own screenshot at the selected viewport. */
export async function captureSections(
	page: Page,
	name: string,
	checkpoint: (page: Page, name: string) => Promise<void>
): Promise<void> {
	const tabs = await page.getByRole('tablist').getByRole('tab').allTextContents();
	for (const label of tabs.filter((label) => label.trim() !== 'Overview')) {
		await page.getByRole('tab', { name: label.trim(), exact: true }).click();
		await checkpoint(page, name + '-' + label.trim().toLowerCase().replaceAll(' ', '-'));
	}
}
