import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { ScreenshotName, ScreenshotTarget } from './browserTest.types';
import type { VisualBinding } from './browserCaseCapture.types';
import { findVisualBinding } from './browserCaseBinding';

/** Record only an explicitly declared case from the stamped page actually being captured. */
export async function recordCaseScreenshot(
	info: TestInfo,
	target: ScreenshotTarget,
	name: ScreenshotName,
	capture: { bytes: Buffer; fullPage: boolean }
): Promise<void> {
	const context = evidenceContext();
	if (!context) return;
	const page = isLocator(target) ? target.page() : target;
	const binding = findVisualBinding({
		root: context.root,
		scenarioId: context.scenarioId,
		file: info.file,
		title: info.titlePath.slice(1).join(' > '),
		snapshot: typeof name === 'string' ? name : name.join('/'),
		size: page.viewportSize(),
		mode: captureMode(target, capture.fullPage)
	});
	const buildId = await servedBuild(page);
	const clip = isLocator(target) ? await elementBounds(target) : undefined;
	writeCapture({ ...context, info, binding, buildId, clip, bytes: capture.bytes });
}

function evidenceContext() {
	if (process.env.HARNESS_VERIFY !== '1') return undefined;
	const {
		HARNESS_VERIFY_CASE_ROOT: root,
		HARNESS_SCENARIO: scenarioId,
		HARNESS_EVIDENCE_DIR: directory,
		HARNESS_VERIFY_REVISION: revision
	} = process.env;
	if (!root || !scenarioId || !directory || !revision || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('Visual evidence requires a scenario, snapshot, directory and revision.');
	return { root, scenarioId, directory, revision };
}

async function servedBuild(page: Page): Promise<string> {
	const stamp = await page
		.locator('meta[name="harness-build-id"], meta[name="harness-build"]')
		.getAttribute('content');
	const build = /^harness-build:([a-f0-9]{64})$/.exec(stamp ?? '')?.[1];
	if (!build || /^0+$/.test(build))
		throw new Error('Visual evidence requires a stamped served build.');
	return build;
}

function writeCapture(input: {
	directory: string;
	revision: string;
	info: TestInfo;
	binding: VisualBinding;
	buildId: string;
	bytes: Buffer;
	clip?: { x: number; y: number; width: number; height: number };
}): void {
	const { directory, revision, info, binding, buildId, bytes, clip } = input;
	const sha256 = digest(bytes);
	const note = JSON.stringify({
		unit: binding.unit,
		case: binding.item.id,
		revision,
		sha256,
		retry: info.retry
	});
	const file = `capture-${digest(Buffer.from(`${note}:${binding.viewport.id}`))}.png`;
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, file), bytes, { flag: 'wx' });
	appendFileSync(
		join(directory, 'captures.ndjson'),
		`${JSON.stringify({
			evidence: binding.evidence,
			kind: 'screenshot',
			state: binding.item.state,
			viewport: binding.viewport.id,
			...(clip ? { clip } : {}),
			file,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision },
			note
		})}\n`
	);
}

async function elementBounds(target: Locator) {
	const box = await target.boundingBox();
	if (!box || box.x < 0 || box.y < 0)
		throw new Error('Visual component has no visible capture bounds.');
	const x = Math.floor(box.x),
		y = Math.floor(box.y);
	return {
		x,
		y,
		width: Math.ceil(box.x + box.width) - x,
		height: Math.ceil(box.y + box.height) - y
	};
}

function captureMode(target: ScreenshotTarget, fullPage: boolean) {
	if (isLocator(target)) return 'element';
	return fullPage ? 'full-page' : 'viewport';
}

const isLocator = (target: ScreenshotTarget): target is Locator => 'page' in target;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
