import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	explanationsFile,
	type Explanation
} from '../../src/core/development-tooling/explanationTypes';
import { ExplanationRepository } from '../../src/repositories/verification-evidence/ExplanationRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type Cases = Parameters<typeof recordExampleCases>[1];

const appended: Explanation = {
	unit: 'repository.explanation',
	symbol: 'ExplanationRepository.append',
	file: 'src/repositories/verification-evidence/ExplanationRepository.ts',
	change: 'modified',
	from: '5f0a9c1e3b7d2846',
	to: 'c24e8b19d0a63f7e',
	behavior: 'Appends each entry as one JSON line and creates the scratch folder first.',
	simplification: {
		attempt: 'Tried one appendFile call per entry; the single batched call was kept.',
		outcome: 'improved'
	},
	performance: {
		attempt: 'Not measured; the batch is written with one appendFile call.',
		outcome: 'not-applicable'
	},
	recordedAt: '2026-11-14T16:42:09.517Z'
};

const added: Explanation = {
	unit: 'repository.explanation',
	symbol: 'ExplanationRepository.read',
	file: 'src/repositories/verification-evidence/ExplanationRepository.ts',
	change: 'added',
	from: null,
	to: '9d41be07a6f2c58e',
	behavior: 'Reads the scratch file in order and skips any line that fails explanationSchema.',
	simplification: {
		attempt: 'Considered a streaming reader; readFileSync was kept for a small scratch file.',
		outcome: 'not-improved'
	},
	performance: {
		attempt: 'Not measured; the scratch file holds one line per reason.',
		outcome: 'not-applicable'
	},
	recordedAt: '2026-11-15T09:11:37.204Z'
};

function record(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'repository.explanation',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Appends entries and reads them back in file order', async () => {
	await withTempDir('explanation-append-read-', async (directory) => {
		const repository = new ExplanationRepository(directory);
		await repository.append([appended]);
		await repository.append([added]);
		const read = repository.read();

		expect(read).toEqual([appended, added]);
		record('appends-entries-and-reads-them-back-in-file-order', 'ExplanationRepository.append', [
			{
				name: 'two single-entry appends are read back in file order',
				input: { first: [appended.symbol], second: [added.symbol] },
				output: read
			}
		]);
	});
});

test('Skips damaged lines when reading the scratch file', async () => {
	await withTempDir('explanation-damaged-lines-', async (directory) => {
		const repository = new ExplanationRepository(directory);
		await repository.append([appended]);
		appendFileSync(join(directory, explanationsFile), 'not json\n{"unit":"incomplete"}\n');
		const read = repository.read();

		expect(read).toEqual([appended]);
		record('skips-damaged-lines-when-reading-the-scratch-file', 'ExplanationRepository.read', [
			{
				name: 'a non-JSON line and a schema-invalid object are skipped',
				input: { lines: ['not json', '{"unit":"incomplete"}'] },
				output: read
			}
		]);
	});
});

test('Lists scratch reasons when the root is not a repository', async () => {
	await withTempDir('explanation-outside-repository-', async (directory) => {
		const repository = new ExplanationRepository(directory);
		await repository.append([appended, added]);
		const all = await repository.all();

		expect(all).toEqual([appended, added]);
		record('lists-scratch-reasons-when-the-root-is-not-a-repository', 'ExplanationRepository.all', [
			{
				name: 'outside a Git repository all() returns the scratch-file reasons in file order',
				input: { root: 'temporary directory', entries: [appended.symbol, added.symbol] },
				output: all
			}
		]);
	});
});

test('Throws TypeError when the constructor file is not a string', () => {
	const build = () => new ExplanationRepository('/workspace/project', 42 as unknown as string);

	expect(build).toThrow(TypeError);
	record('throws-typeerror-when-the-constructor-file-is-not-a-string', 'ExplanationRepository.constructor', [
		{
			name: 'a numeric file name makes the constructor throw TypeError',
			input: { root: '/workspace/project', file: 42 },
			error: 'TypeError'
		}
	]);
});

test('Throws Error when the scratch file cannot be read', async () => {
	await withTempDir('explanation-unreadable-scratch-', (directory) => {
		mkdirSync(join(directory, explanationsFile), { recursive: true });
		const repository = new ExplanationRepository(directory);

		expect(() => repository.read()).toThrow(Error);
		record('throws-error-when-the-scratch-file-cannot-be-read', 'ExplanationRepository.read', [
			{
				name: 'a scratch path that is a folder makes read throw Error',
				input: { scratchPath: 'a folder' },
				error: 'Error'
			}
		]);
	});
});

test('Throws Error when the scratch folder cannot be created', async () => {
	await withTempDir('explanation-blocked-folder-', async (directory) => {
		writeFileSync(join(directory, 'blocker'), 'not a folder\n');
		const repository = new ExplanationRepository(join(directory, 'blocker'));

		await expect(repository.append([appended])).rejects.toThrow(Error);
		record('throws-error-when-the-scratch-folder-cannot-be-created', 'ExplanationRepository.append', [
			{
				name: 'a root that is a file makes append reject with Error',
				input: { root: 'a file', entries: [appended.symbol] },
				error: 'Error'
			}
		]);
	});
});
