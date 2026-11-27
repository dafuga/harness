import { execFileSync } from 'node:child_process';
import { expect, type Page } from '../../../../test/support/browserTest';
import { viewSettings, closeViewSettings, doneCheckpoint } from './game-unsaved-fixture';
import { capture, catalogNavigation } from './game-native-fixture';

export async function history(page: Page, root: string, dimension: string) {
	execFileSync('git', ['add', '.'], { cwd: root });
	execFileSync(
		'git',
		[
			'-c',
			'user.name=Harness Test',
			'-c',
			'user.email=harness-test@example.invalid',
			'commit',
			'-m',
			'feat: save authored game'
		],
		{ cwd: root }
	);
	const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	const url = new URL(page.url());
	url.searchParams.set('commit', commit);
	url.searchParams.set('readonly', '1');
	await page.goto(url.href);
	await viewSettings(page);
	await expect(page.getByLabel('View title', { exact: true })).toHaveAttribute('readonly', '');
	await closeViewSettings(page);
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collected key', { exact: true }).first().click();
	await expect(
		page.getByRole('img', { name: 'Collected key gameplay reference', exact: true })
	).toBeVisible();
	await capture(page, `${dimension}-history`);
	await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeDisabled();
	await doneCheckpoint(page);
	await page.getByRole('link', { name: 'Back to project', exact: true }).click();
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories', exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Game Views', exact: true })).toBeVisible();
	await capture(page, `${dimension}-catalog`);
	await catalogNavigation(page);
}
