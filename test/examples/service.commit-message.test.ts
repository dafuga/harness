import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { CommitMessageService } from '../../src/services/git-source-history/commit-message-service/CommitMessageService';

const unitId = 'service.commit-message';

function metaFor(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function messageFile(directory: string, text: string): string {
	const file = join(directory, 'COMMIT_EDITMSG');
	writeFileSync(file, text);
	return file;
}

test('Passes a staged message of an unheld index', async () => {
	await withTempDir('commit-message-written-', async (directory) => {
		const file = messageFile(directory, 'feat: add ledger export\n\nWrites the export file.\n');
		const service = new CommitMessageService(directory);
		const problems = await service.written(file, false);

		expect(problems).toEqual([]);
		recordExampleCases(metaFor('written', 'passes-a-staged-message-of-an-unheld-index'), [
			{
				name: 'staged message in a repository without a declared writing version',
				input: { file: 'COMMIT_EDITMSG', edited: false },
				output: problems
			}
		]);
	});
});

test('Finds no stored problem in undeclared history', async () => {
	await withTempRepo(async (repository) => {
		repository.git('commit', '--allow-empty', '-m', 'feat: first commit');
		repository.git('commit', '--allow-empty', '-m', 'fix: second commit');
		const service = new CommitMessageService(repository.root);
		const problems = await service.stored(null, 'HEAD');

		expect(problems).toEqual([]);
		let error: unknown;
		try {
			await service.stored('no-such-commit', 'HEAD');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(metaFor('stored', 'finds-no-stored-problem-in-undeclared-history'), [
			{
				name: 'two commits without a declared writing version have no problem',
				input: { base: null, head: 'HEAD' },
				output: problems
			},
			{
				name: 'a base that git cannot resolve rejects',
				input: { base: 'no-such-commit', head: 'HEAD' },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]);
	});
});

test('Keeps the report failures of undeclared history', async () => {
	await withTempRepo(async (repository) => {
		repository.git('commit', '--allow-empty', '-m', 'chore: start history');
		const service = new CommitMessageService(repository.root);
		const report = { failures: ['existing failure'], rows: 2 };
		const result = await service.reported(report, null, 'HEAD');

		expect(result).toEqual({ failures: ['existing failure'], rows: 2 });
		expect(report).toEqual({ failures: ['existing failure'], rows: 2 });
		recordExampleCases(metaFor('reported', 'keeps-the-report-failures-of-undeclared-history'), [
			{
				name: 'report with one failure and two rows keeps both when nothing is held',
				input: { report, base: null, head: 'HEAD' },
				output: result
			}
		]);
	});
});
