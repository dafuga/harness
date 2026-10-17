import { chromium, type Page } from '@playwright/test';
import { browserErrorCollector } from './browserTest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScenarioManifest } from '../../src/core/unitTypes';
import { gatherCaptures } from '../../src/utils/gatherCaptures';
import { recordCapture } from '../../src/utils/recordCapture';
import { scenarioCoverage } from '../../src/utils/scenarioCoverage';
import { sessions } from './consoleHost';
import type { LocalWorker } from './workers';

/** The console of an installed host as a scenario: one state, served by the declared build. */
const hostScenario: ScenarioManifest = {
	schemaVersion: 1,
	id: 'console-host',
	title: 'Console installed in a Cloudflare host',
	kind: 'ui',
	units: ['function.console-access'],
	states: [{ id: 'pages', title: 'Pages of the explorer', coverage: 'required' }],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [
		{ id: 'host', kind: 'e2e', runner: 'vitest', target: 'test/console-storage.e2e.test.ts' }
	],
	evidence: [
		{
			id: 'screens',
			kind: 'screenshot',
			states: ['pages'],
			viewports: ['desktop'],
			provenance: 'actual-capture',
			build: 'console-host',
			required: true
		}
	]
};

export interface HostCapture {
	/** What the running server said about itself when it was captured. */
	reported: { buildId: string | null; sdk: { version: string }; host: { revision: string | null } };
	screenshot: Buffer;
}

/**
 * Captures the console of one running host as a scenario check does: the administrator's page as
 * a screenshot, recorded beside the build the server itself reported and the revision the check
 * was told it is verifying.
 */
export async function captureHost(
	worker: LocalWorker,
	evidence: string,
	revision: string,
	path = '/harness'
): Promise<HostCapture> {
	const browser = await chromium.launch();
	const errors = browserErrorCollector();
	let failure: unknown;
	try {
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		errors.watch(context);
		await context.addCookies([{ name: 'session', value: sessions.admin, url: worker.url }]);
		const page = await context.newPage();
		await page.goto(worker.url + path);
		await settledHost(page);
		const answer = await page.request.get(`${worker.url}/harness/data/build.json`);
		const reported = (await answer.json()) as HostCapture['reported'];
		const screenshot = await page.screenshot();
		const capture = { reported, screenshot };
		await keepHostCapture(capture);
		const categories = page
			.getByRole('banner')
			.getByRole('navigation', { name: 'Harness categories' });
		await categories.locator('a[aria-current="page"]', { hasText: 'Pages' }).waitFor();
		recordHostCapture(capture, { evidence, revision });
		return capture;
	} catch (error) {
		failure = error;
		throw error;
	} finally {
		await browser.close();
		await finishHostErrors(errors, failure);
	}
}

function recordHostCapture(capture: HostCapture, target: { evidence: string; revision: string }) {
	const server = { buildId: capture.reported.buildId ?? 'unstamped', revision: target.revision };
	recordCapture(
		{
			evidence: 'screens',
			kind: 'screenshot',
			state: 'pages',
			viewport: 'desktop',
			file: 'pages-desktop.png',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server
		},
		capture.screenshot,
		{ HARNESS_EVIDENCE_DIR: target.evidence, TAKE_SCREENSHOT: '1' }
	);
}

async function finishHostErrors(
	errors: ReturnType<typeof browserErrorCollector>,
	failure: unknown
) {
	try {
		await errors.finish();
	} catch (error) {
		if (failure !== undefined)
			throw new AggregateError(
				[failure, error],
				`Host flow failed with browser errors\n${errorDetails(failure)}\n${errorDetails(error)}`
			);
		throw error;
	}
}

function errorDetails(error: unknown): string {
	return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

async function settledHost(page: Page): Promise<void> {
	await page.getByRole('heading', { level: 1, name: 'Pages', exact: true }).waitFor();
	await page.evaluate(async () => {
		await globalThis.document.fonts.ready;
		const images = [...globalThis.document.images].filter((image) => {
			const box = image.getBoundingClientRect();
			return box.width > 0 && box.height > 0 && box.top < globalThis.innerHeight && box.bottom > 0;
		});
		await Promise.all(
			images.map(async (image) => {
				await image.decode();
				if (!image.complete || !image.naturalWidth || !image.naturalHeight)
					throw new Error('Host screenshot image is not ready.');
			})
		);
	});
}

async function keepHostCapture(capture: HostCapture): Promise<void> {
	const phase = process.env.SCREENSHOT_LABEL ?? 'current';
	const build = capture.reported.buildId?.slice(0, 12) ?? 'unstamped';
	await keepCapture(`host-${phase}-${build}`, capture, {});
}

/** What the verifier's capture judge says about that evidence, for the build setup compiled. */
export function judgeHost(evidence: string, commit: string, compiled: string): string[] {
	const { gathered, failures } = gatherCaptures(evidence, 'evidence');
	const builds = { declared: ['console-host'], compiled: new Map([['console-host', compiled]]) };
	const judged = scenarioCoverage({
		scenario: hostScenario,
		commit,
		gathered,
		checkFailed: false,
		builds
	});
	return [...failures, ...judged.failures];
}

/** Keeps a capture and its stated identities where a person can look at them afterwards. */
export async function keepCapture(
	name: string,
	capture: HostCapture,
	facts: object
): Promise<void> {
	const directory = process.env.HARNESS_CAPTURE_DIR;
	if (!directory) return;
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, `${name}.png`), capture.screenshot);
	const stated = { ...facts, reported: capture.reported };
	await writeFile(join(directory, `${name}.json`), `${JSON.stringify(stated, null, 2)}\n`);
}
