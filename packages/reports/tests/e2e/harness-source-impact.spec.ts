import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { revision, seeded } from './support/harnessHistory';

const { commits, repository } = seeded();
const impact = (page: Page) => page.getByRole('region', { name: 'Impact' });
const listed = async (page: Page, name: string) =>
	(await impact(page).getByRole('list', { name }).getByRole('listitem').allInnerTexts()).map(
		(text) => text.trim()
	);

/** What the impact command says about the same two commits of the inspected repository. */
function authoritative(base: string, head: string) {
	const cli = resolve('../../src/index.ts');
	const output = execFileSync('bun', [cli, 'impact', '--base', base, '--head', head, '--json'], {
		cwd: repository,
		encoding: 'utf8',
		env: { ...process.env, HARNESS_ANALYTICS_DISABLED: '1' }
	});
	return JSON.parse(output) as {
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: { affected: string[] };
	};
}

test('a commit nobody verified still shows what its source change affects, as the CLI computes it', async ({
	page
}) => {
	// The commit changed one source file; its manifests are untouched and it has no record.
	const detail = revision(commits.sourceOnly);
	expect(detail.records).toEqual([]);
	const cli = authoritative(commits.unverified, commits.sourceOnly);
	expect(cli.units.direct).toEqual(['function.clock']);
	expect(cli.units.indirect.length).toBeGreaterThan(0);

	await page.goto(`/harness?view=compare&base=${commits.unverified}&commit=${commits.sourceOnly}`);
	await expect(impact(page)).toContainText('Computed from the source of both commits');
	await expect(impact(page)).toContainText('This commit has no verification record');
	await expect(impact(page)).not.toContainText('Recorded by verification');
	expect(await listed(page, 'Directly changed')).toEqual(cli.units.direct);
	expect(await listed(page, 'Indirectly affected')).toEqual([...cli.units.indirect].sort());
	expect(await listed(page, 'Affected scenarios')).toEqual([...cli.scenarios.affected].sort());
	expect(await listed(page, 'Added')).toEqual([]);
	const map = page.getByRole('group', { name: 'Component map' });
	await expect(
		map.getByRole('button', { name: /^function\.clock,.*directly changed/ })
	).toBeVisible();
	// The history of the same commit states the gap instead of implying it was tested.
	await page.goto(`/harness?view=history&commit=${commits.sourceOnly}`);
	await expect(page.getByText('No verification record is attached to this commit')).toBeVisible();
});

test('two commits that are not parent and child say what is not known about the pair', async ({
	page
}) => {
	await page.goto(`/harness?view=compare&base=${commits.reordered}&commit=${commits.sourceOnly}`);
	await expect(impact(page)).toContainText('not parent and child');
	expect(await listed(page, 'Directly changed')).toEqual(
		expect.arrayContaining(['function.clock', 'function.slugify'])
	);
	await expect(impact(page)).toContainText('Not known here.');
});
