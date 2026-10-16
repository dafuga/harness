import { chromium } from '@playwright/test';
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
	try {
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		await context.addCookies([{ name: 'session', value: sessions.admin, url: worker.url }]);
		const page = await context.newPage();
		await page.goto(worker.url + path);
		// The explorer opens on Pages: the bar marks that category once the address is resolved.
		const categories = page
			.getByRole('banner')
			.getByRole('navigation', { name: 'Harness categories' });
		await categories.locator('a[aria-current="page"]', { hasText: 'Pages' }).waitFor();
		await page.getByRole('heading', { level: 1, name: 'Pages' }).waitFor();
		const answer = await page.request.get(`${worker.url}/harness/data/build.json`);
		const reported = (await answer.json()) as HostCapture['reported'];
		const screenshot = await page.screenshot();
		const server = { buildId: reported.buildId ?? 'unstamped', revision };
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
			screenshot,
			{ HARNESS_EVIDENCE_DIR: evidence, TAKE_SCREENSHOT: '1' }
		);
		return { reported, screenshot };
	} finally {
		await browser.close();
	}
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
