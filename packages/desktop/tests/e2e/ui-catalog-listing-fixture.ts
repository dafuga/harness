import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { desktopEvidence } from './desktop-evidence';

interface Shown {
	revision: { commit: string };
	entities: { id: string }[];
}
export interface ListedProject {
	tip: Shown;
	earlier: Shown;
	/** The detail of the analytics identity at each of the two commits. */
	details: Record<string, unknown>;
}

function install(data: ListedProject) {
	const earlier = data.earlier.revision.commit;
	const bridge = {
		openProject: async () => data.tip,
		snapshot: async (query: { commit: string | null }) =>
			query.commit === earlier ? data.earlier : data.tip,
		entity: async (query: { commit: string }) => data.details[query.commit],
		source: async () => ({ path: '', text: '' }),
		image: async () => new Uint8Array(),
		providers: async () => [],
		messages: async () => [],
		onRunEvent: () => () => {}
	};
	Object.assign(window, { harness: bridge });
}

/**
 * Gives the page the project the real session listed. The snapshots are made by the session
 * over a disposable Git project when the test starts, so the cards a test counts are the
 * entities the product selected, at the tip and at the earlier commit.
 */
export async function listedProject(page: Page): Promise<ListedProject> {
	const script = resolve(import.meta.dirname, 'ui-catalog-listing-project.ts');
	const data = JSON.parse(execFileSync('bun', [script], { encoding: 'utf8' })) as ListedProject;
	await page.addInitScript(install, data);
	return data;
}

/** The identity each card of the shown category opens, read from the address of its link. */
export async function listedIds(page: Page): Promise<string[]> {
	const links = page.locator('main.catalog article a');
	const addresses = await links.evaluateAll((all) => all.map((link) => link.getAttribute('href')));
	return addresses.map((address) => decodeURIComponent(address?.split('/').pop() ?? '')).sort();
}

/**
 * The opt-in picture of a run, whole page, taken once fonts and images are ready and before
 * what it shows is judged, so a failing run keeps the state it failed on. A verification records
 * the same checkpoint as evidence of the state it is named for, from the stamped build.
 */
export async function pictured(page: Page, info: TestInfo, name: string): Promise<void> {
	await desktopEvidence(page, `listing-${name}`);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' });
}
