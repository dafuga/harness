import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { siblingBugSweep } from '../../../src/utils/development-tooling/siblingBugSweep';
import type { BugEvaluator } from '../../../src/utils/development-tooling/siblingBugSweep.types';
import { recordBugClass } from '../../../src/utils/development-tooling/sibling-bug-sweep/recordBugClass';
import { reviewKnownClasses } from '../../../src/utils/development-tooling/sibling-bug-sweep/reviewKnownClasses';
import { withTempRepo } from '../../support/temporary';
import { fixtureBugClass, fixtureSource } from '../../support/sibling-bug-sweep/bugFixture';
import { measureWorkload } from '../../support/measureWorkload';

const analysis: BugEvaluator = async ({ prompt, schema }) => {
	const data = JSON.parse(prompt.split('\n').at(-1)!);
	return schema.parse(
		data.candidates
			? {
					results: data.candidates.map(({ id, path }: { id: string; path: string }) => ({
						id,
						verdict: path.endsWith('.svelte') ? 'dismissed' : 'confirmed',
						impact: 3,
						evidence: 'Source shows the scope at line 3.'
					}))
				}
			: fixtureBugClass
	);
};

test('siblingBugSweep ranks semantically distinct sites from the pinned commit', async () => {
	await withTempRepo(async (repo) => {
		await fixtureSource(repo);
		const revision = repo.git('rev-parse', 'HEAD');
		await writeFile(join(repo.root, 'src/bulk.ts'), 'export const uncommitted = 1;');
		await writeFile(join(repo.root, 'src/untracked.ts'), 'JSON.parse(data);');
		const input = {
			root: repo.root,
			revision,
			report: 'Eager parsing',
			model: 'test',
			reviewLimit: 2
		};

		const report = await measureWorkload(
			'function.development-tooling-sibling-bug-sweep',
			'pinned-source-sweep',
			() => siblingBugSweep(input, analysis)
		);
		expect(report).toMatchObject({
			revision,
			scannedFiles: 2,
			skipped: [],
			errors: [],
			bugClass: fixtureBugClass
		});
		expect(report.candidates).toMatchObject([
			{
				path: 'src/bulk.ts',
				line: 3,
				lastLine: 3,
				verdict: 'confirmed',
				matches: [
					{ kind: 'text', value: 'for (const' },
					{ kind: 'call', value: 'JSON.parse' }
				]
			},
			{ path: 'src/small.svelte', line: 3, verdict: 'dismissed' }
		]);
		const partial = await siblingBugSweep({ ...input, reviewLimit: 1 }, analysis);
		expect(partial.candidates.map((site) => site.verdict)).toEqual(['confirmed', 'not-reviewed']);
		const origin = await siblingBugSweep(
			{ ...input, origin: { path: 'src/bulk.ts', line: 3 } },
			analysis
		);
		expect(origin.candidates.map((site) => site.path)).toEqual(['src/small.svelte']);
		const invalid: BugEvaluator = (request) =>
			request.prompt.startsWith('Review')
				? Promise.resolve(request.schema.parse({ results: [] }))
				: analysis(request);
		const failed = await siblingBugSweep(input, invalid);
		expect(failed.errors).toHaveLength(1);
		expect(failed.candidates.every((site) => site.verdict === 'not-reviewed')).toBe(true);
	});
});

test('reviewKnownClasses reads the base registry and evaluates changed source', async () => {
	await withTempRepo(async (repo) => {
		await fixtureSource(repo);
		await recordBugClass(repo.root, fixtureBugClass, repo.git('rev-parse', 'HEAD'));
		repo.git('add', 'specification');
		repo.git('commit', '-qm', 'chore: register bug class');
		const base = repo.git('rev-parse', 'HEAD');
		const input = { root: repo.root, base, model: 'test', reviewLimit: 5 };
		await mkdir(join(repo.root, 'extra'));
		await writeFile(
			join(repo.root, 'extra/new.ts'),
			'export const bulk = (items: string[]) => items.map(x => JSON.parse(x));'
		);
		repo.git('add', 'extra');
		repo.git('commit', '-qm', 'feat: load added collection');
		const reviewed = await reviewKnownClasses(input, analysis);
		expect(reviewed.passed).toBe(false);
		expect(reviewed.reports[0].candidates.map((site) => site.path)).toEqual(['extra/new.ts']);

		await writeFile(join(repo.root, 'extra/new.ts'), 'export const single = 2;');
		repo.git('commit', '-qam', 'fix: avoid bulk parse');
		expect((await reviewKnownClasses(input, analysis)).passed).toBe(true);
	});
});
