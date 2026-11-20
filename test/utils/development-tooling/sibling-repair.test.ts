import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { TaskRunner } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { siblingBugSweep } from '../../../src/utils/development-tooling/siblingBugSweep';
import { repairSiblings } from '../../../src/workflows/development-tooling/sibling-bug-sweep/repairSibling';
import type { BugEvaluator } from '../../../src/utils/development-tooling/siblingBugSweep.types';
import { withTempRepo } from '../../support/temporary';
import { fixtureBugClass } from '../../support/sibling-bug-sweep/bugFixture';

test.each(['accepted', 'rejected', 'failed'] as const)(
	'sibling repair keeps red and green proof and derives the %s result without modifying the caller checkout',
	async (outcome) => {
		await withTempRepo(async ({ root, git }) => {
			await mkdir(join(root, 'src'));
			await mkdir(join(root, 'test'));
			await writeFile(join(root, 'src/bulk.ts'), 'export const value = JSON.parse("1");\n');
			await writeFile(join(root, 'src/unknown.ts'), 'export const unknown = JSON.parse("1");\n');
			await writeFile(join(root, 'test/value.test.ts'), fixtureTest(1));
			git('add', '.');
			git('commit', '-qm', 'feat: initialize sibling repair fixture');
			const calls: string[] = [];
			const evaluate = repairEvaluator(outcome === 'accepted');
			const report = await siblingBugSweep(
				{ root, report: 'Large parse', model: 'fixture', reviewLimit: 20 },
				evaluate
			);
			const runner = fixtureWorker(outcome, calls);
			const before = git('worktree', 'list', '--porcelain');
			const results = await repairSiblings(
				report,
				{
					root,
					runId: 'fixture',
					testCommand: 'bun test test/value.test.ts',
					workerModel: 'fixture'
				},
				{ evaluate, runner }
			);
			expect(results).toHaveLength(1);
			const [result] = results;
			expect(result.outcome).toBe(outcome);
			expect(calls).toEqual(outcome === 'failed' ? ['test'] : ['test', 'fix']);
			if (outcome !== 'failed') {
				const red = result.red!.commit,
					green = result.green!.commit;
				expect(git('rev-parse', green + '^')).toBe(red);
				expect(git('diff', red, green, '--', 'test')).toBe('');
			}
			if (outcome === 'accepted') expect(git('rev-parse', result.ref!)).toBe(result.green?.commit);
			else expect(result.ref).toBeUndefined();
			expect(git('status', '--short')).toBe('');
			expect(git('worktree', 'list', '--porcelain')).toBe(before);
		});
	},
	45_000
);

function repairEvaluator(accepted: boolean): BugEvaluator {
	return async ({ prompt, schema }) => {
		const data = JSON.parse(prompt.split('\n').at(-1)!);
		if (data.test)
			return schema.parse({
				accepted,
				evidence: 'Review found the exact failing assertion and repaired site.'
			});
		if (!data.candidates) return schema.parse(fixtureBugClass);
		return schema.parse({
			results: data.candidates.map(({ id, path }: { id: string; path: string }) => ({
				id,
				verdict: path.endsWith('bulk.ts') ? 'confirmed' : 'unconfirmed',
				impact: 4,
				evidence: 'The source shows an eager parse.'
			}))
		});
	};
}

function fixtureWorker(outcome: string, calls: string[]): TaskRunner {
	return {
		async run(input) {
			const test = input.prompt.includes('Edit only standardized tests');
			calls.push(test ? 'test' : 'fix');
			if (test)
				await writeFile(
					join(input.cwd, 'test/value.test.ts'),
					fixtureTest(outcome === 'failed' ? 1 : 2)
				);
			else await writeFile(join(input.cwd, 'src/bulk.ts'), 'export const value = 2;\n');
			return {
				...input,
				reportedModel: null,
				text: test
					? JSON.stringify({ tests: ['test/value.test.ts'], assertion: 'receipt value differs' })
					: 'Fixed'
			};
		}
	};
}

function fixtureTest(value: number) {
	return `import { test } from 'bun:test';
import { value } from '../src/bulk';
test('receipt value', () => { if (value !== ${value}) throw new Error('receipt value differs'); });\n`;
}
