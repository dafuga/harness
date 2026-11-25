import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runHarness } from '../cli';
import { withTempRepo } from '../temporary';
import { fixtureEvaluator, fixtureSource } from './bugFixture';
import { exerciseSecurityReviewCli } from './exerciseSecurityReviewCli';

export async function exerciseSiblingCli() {
	await withTempRepo(async (repo) => {
		await fixtureSource(repo);
		const env = await fixtureEvaluator(repo.root);
		const revision = repo.git('rev-parse', 'HEAD');
		const before = repo.git('status', '--short');
		const worktrees = repo.git('worktree', 'list', '--porcelain');
		const input = ['loop', 'siblings', '--commit', revision, '--report', 'Eager parse'];
		const readOnly = await runHarness([...input, '--report-only'], repo.root, true, env);
		const report = JSON.parse(readOnly.stdout);
		expect(report).toMatchObject({ revision, scannedFiles: 2 });
		expect(report.candidates.map((site: { verdict: string }) => site.verdict)).toEqual([
			'confirmed',
			'dismissed'
		]);
		expect(repo.git('status', '--short')).toBe(before);
		expect(repo.git('worktree', 'list', '--porcelain')).toBe(worktrees);
		const invalid = await runHarness(
			[...input, '--report-only', '--repair'],
			repo.root,
			false,
			env
		);
		expect(invalid.exitCode).toBe(1);
		expect(invalid.stderr).toContain('Repair requires a loop');

		await runHarness(
			['loop', 'create', 'reported', '--from', 'bug-fix', '--goal', 'Prove eager parsing'],
			repo.root
		);
		const retained = await runHarness([...input, 'reported'], repo.root, true, env);
		expect(JSON.parse(retained.stdout).evidence).toMatch(/^siblings-.*\.json$/);
		const path = join(repo.root, 'specification', 'bug-classes', 'eager-parse.json');
		expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
			revision,
			bugClass: { id: 'eager-parse' }
		});
		repo.git('add', 'specification/bug-classes');
		repo.git('commit', '-qm', 'chore: register eager parse class');
		const base = repo.git('rev-parse', 'HEAD');
		await writeFile(
			join(repo.root, 'src/bulk-new.ts'),
			'export const load = (rows: string[]) => rows.map(JSON.parse.bind(JSON));\nJSON.parse("0");'
		);
		repo.git('add', 'src/bulk-new.ts');
		repo.git('commit', '-qm', 'feat: load a new bulk collection');
		const review = await runHarness(['loop', 'review-bugs', base], repo.root, false, env);
		expect(review.exitCode).toBe(1);
		expect(JSON.parse(review.stdout).reports[0].candidates).toMatchObject([
			{ path: 'src/bulk-new.ts', verdict: 'confirmed' }
		]);
	});
	await exerciseSecurityReviewCli();
}

export async function expectSiblingProof(root: string) {
	const missing = await runHarness(
		['loop', 'complete', 'repair', 'siblings', '--evidence', 'Trust me'],
		root,
		false
	);
	expect(missing.stderr).toContain('record a sibling report');
	const env = await fixtureEvaluator(root);
	const scanned = await runHarness(
		['loop', 'siblings', 'repair', '--report', 'A missing behavior check'],
		root,
		true,
		env
	);
	expect(JSON.parse(scanned.stdout)).toMatchObject({
		evidence: expect.stringMatching(/^siblings-/),
		errors: []
	});
}
