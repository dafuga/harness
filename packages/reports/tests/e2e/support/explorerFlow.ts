import type { Observed, Flow } from './explorerFlow.types';
import type { Page } from '@playwright/test';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';
import { categories, nav } from './explorer';
import { evidenceDirectory, servedBuild } from './harnessCapture';

const text = async (page: Page, selector: string) =>
	(
		await page
			.locator(selector)
			.first()
			.textContent({ timeout: 2000 })
			.catch(() => null)
	)?.trim() ?? '';
const chosen = (page: Page, name: string) =>
	page
		.getByRole('combobox', { name })
		.inputValue({ timeout: 2000 })
		.catch(() => null);

/** Reads what the settled screen shows: where it is, what it is about and how it is marked. */
export async function observed(page: Page): Promise<Observed> {
	const url = new URL(page.url());
	const content = page.locator('.ex-content');
	const marks = await content
		.locator('.hx-verdict button[aria-label]')
		.evaluateAll((all) => [...new Set(all.map((item) => item.getAttribute('aria-label') ?? ''))]);
	const drawn = (await content.innerText().catch(() => '')).match(
		/\b(?:src|packages|tests?)\/[\w./+[\]-]+/g
	);
	return {
		address: url.pathname + url.search,
		heading: await text(page, '.ex-content h1'),
		categories: await nav(page).locator('a, button').allTextContents(),
		category: await nav(page)
			.locator('[aria-current="page"]')
			.textContent()
			.catch(() => null),
		branch: await chosen(page, 'Branch'),
		commit: await chosen(page, 'Commit'),
		marks: marks.slice(0, 12),
		paths: [...new Set(drawn ?? [])]
	};
}

/** The checks every flow is held to, judged from what was observed and nothing else. */
function assertions(flow: Flow, seen: Observed) {
	const scope = flow.asked
		.split('?')[0]
		.split('/')
		.slice(0, flow.asked.includes('/commit/') ? 6 : 4);
	return [
		{
			name: 'The screen stays in the branch and commit that were asked for',
			passed: seen.address.startsWith(scope.join('/'))
		},
		{
			name: 'All eight navigation links are offered, pages first',
			passed: seen.categories.join() === categories.join()
		},
		{ name: 'The screen has a heading', passed: seen.heading.length > 0 },
		{
			name: flow.source ? 'Source is shown because it was asked for' : 'No source path is shown',
			passed: flow.source ? seen.paths.length > 0 : seen.paths.length === 0
		}
	];
}

/**
 * Records one flow of the explorer as end-to-end evidence: what was asked, what was done, what
 * the served application then showed, and what was asserted of it. The values are those the
 * browser observed in this run; the capture names the build that served them.
 */
export async function captureFlow(
	page: Page,
	flow: Flow,
	directory = evidenceDirectory
): Promise<void> {
	const seen = await observed(page);
	const server = await servedBuild(page);
	const scenario = 'Harness explorer over a fixed synthetic history';
	const shared = {
		state: flow.state,
		mediaType: 'application/json',
		provenance: 'actual-capture' as const
	};
	const stamp = server ? { server } : {};
	const run = {
		scenario,
		environment: 'Chromium against the built reports server',
		fixture: 'Synthetic Git history seeded for the console',
		steps: [
			`Open ${flow.asked}`,
			flow.expects,
			'Read the address, the heading, the categories and the verification marks'
		],
		input: { address: flow.asked },
		output: seen
	};
	const env = { HARNESS_EVIDENCE_DIR: directory, TAKE_SCREENSHOT: '1' };
	recordCapture(
		{ ...shared, ...stamp, evidence: 'flow', kind: 'output', file: `${flow.state}-flow.json` },
		JSON.stringify(run, null, 2),
		env
	);
	recordCapture(
		{
			...shared,
			...stamp,
			evidence: 'checks',
			kind: 'assertions',
			file: `${flow.state}-checks.json`
		},
		JSON.stringify({ scenario, assertions: assertions(flow, seen) }, null, 2),
		env
	);
}

export type { Observed, Flow } from './explorerFlow.types';
