import { expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageBenchmark, pageUnit } from './pageBenchmark';
import { home, short } from './harnessHistory';
import { settled, servedBuild } from './harnessCapture';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';

/** What the seed recorded about the explorer's part of the synthetic history. */
export interface SeededExplorer {
	explorerBranch: string;
	explorerUnits: Record<'page' | 'list' | 'row' | 'slugify' | 'config' | 'service', string>;
}
export const explorer = (): SeededExplorer =>
	JSON.parse(readFileSync(join(home, 'meta.json'), 'utf8')) as SeededExplorer;

export const categories = [
	'Pages',
	'Shells',
	'Components',
	'Helpers',
	'Configs',
	'Services',
	'Models'
];
export const visualSections = [
	'Overview',
	'Contract',
	'Used In',
	'Uses',
	'States',
	'History',
	'Source'
];
export const nav = (page: Page) => page.getByRole('navigation', { name: 'Harness categories' });
export const branch = (page: Page) => page.getByRole('combobox', { name: 'Branch' });
export const commit = (page: Page) => page.getByRole('combobox', { name: 'Commit' });
export const pathOf = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

/** The address of a branch tip, with the branch as one encoded segment. */
export const tip = (name: string, rest: string) =>
	`/harness/branch/${encodeURIComponent(name)}/${rest}`;
/** The address of a selected commit of a branch. */
export const at = (name: string, sha: string, rest: string) =>
	`/harness/branch/${encodeURIComponent(name)}/commit/${sha}/${rest}`;

/** Where the screenshots of a run go when it was asked to take them. */
const shots = process.env.HARNESS_EXPLORER_SHOTS ?? join(home, 'explorer-shots');

/**
 * Keeps what the page shows at the point an assertion is about to be made, when the run was asked
 * to with TAKE_SCREENSHOT=1. The same name is the same checkpoint before and after a change.
 */
export async function checkpoint(page: Page, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== '1') return;
	mkdirSync(shots, { recursive: true });
	await page.waitForLoadState('networkidle');
	await settled(page);
	const bytes = await page.screenshot({
		path: join(shots, `${name}.png`),
		fullPage: true
	});
	await pageScreenshot(page, name, bytes);
	await pageBenchmark(page, name, pageUnit(page.url()));
}

/** Each persisted picture names the actual app page, state, viewport and served revision. */
async function pageScreenshot(page: Page, name: string, bytes: Buffer): Promise<void> {
	const unit = pageUnit(page.url());
	const server = await servedBuild(page);
	if (!unit || !server || server.revision !== process.env.HARNESS_VERIFY_REVISION) return;
	const width = page.viewportSize()!.width;
	const state = new URL(page.url()).searchParams.get('tab') ?? 'overview';
	recordCapture(
		{
			evidence: unit,
			kind: 'screenshot',
			state,
			viewport: width >= 1200 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile',
			file: name + '.png',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server
		},
		bytes
	);
}

/** The navbar says which tip the branch has and which commit is looked at. */
export async function expectScope(
	page: Page,
	scope: { tip: string; viewed: string; label: string }
): Promise<void> {
	expect(await branch(page).getAttribute('title')).toContain(`Tip · ${short(scope.tip)}`);
	await expect(commit(page)).toHaveValue(scope.viewed);
	expect(await commit(page).getAttribute('title')).toContain(scope.label);
}

/** Nothing on the page is wider than the window, so a phone never scrolls sideways. */
export async function expectNoOverflow(page: Page): Promise<void> {
	const [content, window] = await page.evaluate(() => [
		document.documentElement.scrollWidth,
		document.documentElement.clientWidth
	]);
	expect(content).toBeLessThanOrEqual(window);
}

/**
 * The verification mark of an entity: only a check or a cross is drawn, and what it says is its
 * accessible name, with the reasons in a tooltip.
 */
export const verdict = (page: Page, label: string | RegExp) =>
	page.locator('.ex-content').getByRole('button', { name: label });

/** Waits until the address is exactly this path and query. */
export async function expectPath(page: Page, path: string): Promise<void> {
	await expect(page).toHaveURL((url) => url.pathname + url.search === path);
}

interface Judging {
	id: string;
	status: string;
	valid: boolean;
	finishedAt: string;
	source: { commit: string };
	scenarios: Array<{
		id: string;
		inherited: boolean;
		origin: { commit: string };
		states: Array<{
			id: string;
			captures: Array<{
				kind: string;
				viewport?: string;
				sha256: string;
				media: string | null;
			}>;
		}>;
	}>;
}

/** The record that judges a commit, read from the built history: its newest usable one. */
export function judging(commit: string): Judging | undefined {
	const stored = JSON.parse(
		readFileSync(join(home, 'data/revisions', `${commit}.json`), 'utf8')
	) as { records: Judging[] };
	return stored.records
		.filter((record) => record.valid && record.source.commit === commit)
		.sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))[0];
}

/** The file of the screenshot a commit recorded for one state of a scenario at one viewport. */
export function recordedShot(
	commit: string,
	where: { scenario: string; state: string; viewport: string }
): string {
	const state = judging(commit)
		?.scenarios.find((item) => item.id === where.scenario)
		?.states.find((item) => item.id === where.state);
	const shot = state?.captures.find(
		(item) => item.kind === 'screenshot' && item.viewport === where.viewport
	);
	if (!shot?.media) throw new Error(`no stored ${where.state} at ${where.viewport} for ${commit}`);
	return shot.media.replace(/^media\//, '');
}

/** Overview exposes actual source size and whatever runtime observations were recorded. */
export async function measured(page: Page, emitted = true): Promise<void> {
	await expect(page.getByRole('region', { name: 'Size', exact: true })).toHaveCount(0);
	const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
	await expect(profile).toBeVisible();
	for (const label of ['Source size', 'Complexity']) await expect(profile).toContainText(label);
	if (emitted) await expect(profile).toContainText('Emitted size');
	else await expect(profile).not.toContainText('Emitted size');
}

/** No repository origin disables GitHub links while archived source remains available. */
export async function sourceWithoutOrigin(page: Page): Promise<void> {
	await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const source = page
		.locator('.ex-content')
		.getByRole('region', { name: 'Source files', exact: true });
	await expect(
		source.getByText('GitHub source unavailable for this revision.', { exact: true })
	).toBeVisible();
	await expect(source.getByRole('link')).toHaveCount(0);
	await expect(source.getByRole('button', { name: /^View code for / }).first()).toBeVisible();
}
