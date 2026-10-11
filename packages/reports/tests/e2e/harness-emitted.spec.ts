import { expect, test, type Page } from '@playwright/test';
import { viewports } from './support/harnessCapture';
import { seeded, short } from './support/harnessHistory';

/**
 * A unit that is built for two execution targets, followed through the console: its first
 * record without any limit, its baseline, a commit where the process output grows while the Wasm
 * output shrinks, the approval of both, and a commit that no longer builds the Wasm output.
 */
const { commits } = seeded();
const kept = '/harness/branch/feature/kept%231';
const unit = 'function.packer';
const budgets = (page: Page) =>
	page
		.getByRole('region', { name: 'Component details' })
		.getByRole('group', { name: 'Budgets and measurements' });
const panel = async (page: Page, commit: string, id = unit) => {
	await page.goto(`${kept}/commit/${commit}/map/unit/${id}`);
	return budgets(page);
};
const sideways = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function limitsOfEachTarget(page: Page): Promise<void> {
	const approved = await panel(page, commits.repacked);
	await expect(approved).toContainText(
		'emitted size (process (native)): 7 bytes · frozen at 7 bytes'
	);
	await expect(approved).toContainText('emitted size (Wasm): 1 byte · frozen at 1 byte');
	// The source limits were reviewed too: each shows the number it is frozen at.
	await expect(approved).toContainText('source-bytes: 95 bytes · frozen at 95');
	await expect(approved).toContainText('complexity: 1 points · frozen at 1');
	// Before any review: both sizes are there, and no limit is claimed for either.
	const first = await panel(page, commits.emitting);
	await expect(first).toContainText(
		'emitted size (process (native)): 3 bytes · no limit is recorded at this revision'
	);
	await expect(first).toContainText('emitted size (Wasm): 5 bytes · no limit is recorded');
	await expect(first).toContainText('A reviewer has to freeze a limit for it.');
	// The same holds for its source: a freeze is declared, and nothing was reviewed yet.
	const unreviewed = 'freeze declared; no reviewed limit is recorded at this revision';
	await expect(first).toContainText(`source-bytes: 95 bytes · ${unreviewed}`);
	await expect(first).toContainText(`complexity: 1 points · ${unreviewed}`);
	await expect(first).toContainText(`dependencies: 0 count · ${unreviewed}`);
	await expect(first).not.toContainText('· frozen at');
	// The commit that grew is shown under the limits it broke, target by target.
	const grown = await panel(page, commits.swapped);
	await expect(grown).toContainText('emitted size (process (native)): 7 bytes · frozen at 3 bytes');
	await expect(grown).toContainText('Grew from 3 to 7 bytes without a recorded approval.');
	await expect(grown).toContainText('emitted size (Wasm): 1 byte · frozen at 5 bytes');
	// A unit this record did not measure still has the limit the ledger of the revision holds.
	const untouched = await panel(page, commits.swapped, 'function.slugify');
	await expect(untouched).toContainText(
		/source-bytes: not measured at this revision\s*· frozen at \d+/
	);
	expect(await sideways(page)).toBeLessThanOrEqual(0);
}

async function goneAndNone(page: Page): Promise<void> {
	const gone = await panel(page, commits.vanished);
	await expect(gone).toContainText(
		'emitted size (Wasm): unavailable: artifacts/packer.wasm was not built in the verified snapshot. · frozen at 1 byte'
	);
	await expect(gone).toContainText('Was 1 byte at its baseline and can no longer be measured.');
	await expect(gone).toContainText('emitted size (process (native)): 7 bytes · frozen at 7 bytes');
	await expect(gone).not.toContainText('emitted size (Wasm): 0');
	const module = await panel(page, commits.vanished, 'service.title');
	await expect(module).toContainText(
		'emitted size: none: A module unit emits no separate artifact. · no limit applies'
	);
}

async function growthWithReviews(page: Page): Promise<void> {
	await page.goto(`${kept}/commit/${commits.vanished}/growth/unit/${unit}`);
	const table = page.getByRole('table', { name: `Emitted sizes of ${unit}` });
	await expect(table.getByRole('columnheader')).toHaveText([
		'Commit',
		'process (native)',
		'Wasm',
		'Limits and why'
	]);
	const row = (commit: string) => table.getByRole('row').filter({ hasText: short(commit) });
	await expect(row(commits.emitting)).toContainText('3 bytes no limit yet');
	await expect(row(commits.emitting)).toContainText(
		'Baseline by Reviewer One: process (native) 3, Wasm 5.'
	);
	const grown = row(commits.swapped);
	await expect(grown).toContainText('7 bytes +4 limit 3');
	await expect(grown).toContainText('1 byte -4 limit 5');
	await expect(grown).toContainText(
		'Approved by Reviewer One: process (native) 3 → 7, Wasm 5 → 1. Reviewed fixture change'
	);
	await expect(grown).toContainText(
		'Packs in upper case, which the process build needs four more bytes for.'
	);
	await expect(row(commits.repacked)).toContainText('7 bytes limit 7');
	await expect(row(commits.vanished)).toContainText(
		'unavailable limit 1 artifacts/packer.wasm was not built in the verified snapshot.'
	);
	expect(await sideways(page)).toBeLessThanOrEqual(0);
	// The way to the evidence is a button the keyboard reaches and opens.
	const evidence = grown.getByRole('button', { name: 'Evidence before and after' });
	await evidence.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`/commit/${commits.swapped}/compare`));
	const measured = page.getByRole('table', { name: 'Measurements before and after' });
	const line = (target: string) =>
		measured.getByRole('row').filter({ hasText: `artifact-bytes (${target})` });
	await expect(line('process (native)')).toHaveText(
		/function\.packer\s*artifact-bytes \(process \(native\)\)\s*3\s*7/
	);
	await expect(line('Wasm')).toHaveText(/function\.packer\s*artifact-bytes \(Wasm\)\s*5\s*1/);
}

async function acrossTheLoss(page: Page): Promise<void> {
	await page.goto(`/harness?view=compare&base=${commits.repacked}&commit=${commits.vanished}`);
	const measured = page.getByRole('table', { name: 'Measurements before and after' });
	const wasm = measured.getByRole('row').filter({ hasText: 'artifact-bytes (Wasm)' });
	await expect(wasm).toHaveText(/function\.packer\s*artifact-bytes \(Wasm\)\s*1\s*unavailable/);
	const process = measured.getByRole('row').filter({ hasText: 'artifact-bytes (process' });
	await expect(process).toHaveText(/7\s*7$/);
	await expect(measured.getByRole('row').filter({ hasText: 'source-bytes' })).toHaveText(
		/95\s*95$/
	);
}

for (const viewport of viewports) {
	test.describe(`at the ${viewport.id} viewport`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		test('the component panel has a size and a limit for each target, beside the source limits', ({
			page
		}) => limitsOfEachTarget(page));
		test('an output that is gone, and a unit that emits nothing, are said as that and never as zero', ({
			page
		}) => goneAndNone(page));
		test('growth has each target commit by commit with its limit, the review and the reason, and leads to the evidence', ({
			page
		}) => growthWithReviews(page));
		test('a comparison across the commit that lost an output has its size before and none after', ({
			page
		}) => acrossTheLoss(page));
	});
}
