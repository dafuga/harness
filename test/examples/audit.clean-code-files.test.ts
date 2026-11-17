import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	readReviewInput,
	reviewHash,
	reviewInputsCurrent
} from '../../src/audit/development-tooling/cleanCodeFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('reviewHash produces SHA-256 digests', () => {
	const answerText = 'export const answer = 42;\n';
	const answerHash = reviewHash(answerText);
	const emptyHash = reviewHash('');

	expect(answerHash).toBe('a2098bd92b10bf8b816d24b7556b1ce8c49a879d130489065ef1051c17e042f6');
	expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	recordExampleCases(
		{
			unitId: 'audit.clean-code-files',
			symbol: 'reviewHash',
			state: 'reviewhash-produces-sha-256-digests',
			evidence: 'examples-cases',
			file: 'reviewhash-produces-sha-256-digests.json'
		},
		[
			{ name: 'source text', input: { value: answerText }, output: answerHash },
			{ name: 'empty text', input: { value: '' }, output: emptyHash }
		]
	);
});

test('readReviewInput reads a contained file', async () => {
	await withTempDir('clean-code-review-input-', async (root) => {
		const directoryPath = 'src/audit/development-tooling';
		const filePath = join(directoryPath, 'cleanCodeFiles.ts');
		const contents = 'export const answer = 42;\n';
		await mkdir(join(root, directoryPath), { recursive: true });
		await writeFile(join(root, filePath), contents);

		const inputFile = await readReviewInput(root, filePath);
		let directoryError: { name: string; message: string } | undefined;
		try {
			await readReviewInput(root, directoryPath);
		} catch (error) {
			directoryError = {
				name: (error as Error).name,
				message: (error as Error).message
			};
		}

		expect(inputFile).toEqual({
			path: filePath,
			contents,
			hash: 'a2098bd92b10bf8b816d24b7556b1ce8c49a879d130489065ef1051c17e042f6'
		});
		expect(directoryError).toEqual({
			name: 'InvalidReviewInputError',
			message: 'Review input is outside the project or is a symlink.'
		});
		recordExampleCases(
			{
				unitId: 'audit.clean-code-files',
				symbol: 'readReviewInput',
				state: 'readreviewinput-reads-a-contained-file',
				evidence: 'examples-cases',
				file: 'readreviewinput-reads-a-contained-file.json'
			},
			[
				{
					name: 'contained source file is decoded and hashed',
					input: { root, path: filePath },
					output: inputFile
				},
				{
					name: 'directory is rejected as a non-file',
					input: { root, path: directoryPath },
					error: directoryError
				}
			]
		);
	});
});

test('reviewInputsCurrent compares saved hashes', async () => {
	await withTempDir('clean-code-review-current-', async (root) => {
		const path = 'src/audit/development-tooling/cleanCodeFiles.ts';
		const contents = 'export const answer = 42;\n';
		await mkdir(join(root, 'src/audit/development-tooling'), { recursive: true });
		await writeFile(join(root, path), contents);
		const matchingInput = {
			path,
			contents,
			hash: 'a2098bd92b10bf8b816d24b7556b1ce8c49a879d130489065ef1051c17e042f6'
		};
		const matching = await reviewInputsCurrent(root, [matchingInput]);
		const mismatch = await reviewInputsCurrent(root, [{ ...matchingInput, hash: '0'.repeat(64) }]);
		const empty = await reviewInputsCurrent(root, []);
		const missing = await reviewInputsCurrent(root, [
			{ path: 'src/missing.ts', contents: '', hash: '0'.repeat(64) }
		]);

		expect(matching).toBe(true);
		expect(mismatch).toBe(false);
		expect(empty).toBe(true);
		expect(missing).toBe(false);
		recordExampleCases(
			{
				unitId: 'audit.clean-code-files',
				symbol: 'reviewInputsCurrent',
				state: 'reviewinputscurrent-compares-saved-hashes',
				evidence: 'examples-cases',
				file: 'reviewinputscurrent-compares-saved-hashes.json'
			},
			[
				{ name: 'matching saved hash', input: { root, inputs: [matchingInput] }, output: matching },
				{
					name: 'changed saved hash',
					input: { root, inputs: [{ ...matchingInput, hash: '0'.repeat(64) }] },
					output: mismatch
				},
				{ name: 'no review inputs', input: { root, inputs: [] }, output: empty },
				{
					name: 'missing review path',
					input: {
						root,
						inputs: [{ path: 'src/missing.ts', contents: '', hash: '0'.repeat(64) }]
					},
					output: missing
				}
			]
		);
	});
});

test('Throws InvalidReviewInputError for outside paths', async () => {
	await withTempDir('clean-code-review-outside-', async (directory) => {
		const root = join(directory, 'project');
		const path = '../outside.ts';
		await mkdir(root);
		await writeFile(join(directory, 'outside.ts'), 'outside');
		let error: { name: string; message: string } | undefined;
		try {
			await readReviewInput(root, path);
		} catch (caught) {
			error = { name: (caught as Error).name, message: (caught as Error).message };
		}
		expect(error?.name).toBe('InvalidReviewInputError');
		expect(error?.message).toBe('Review input is outside the project or is a symlink.');
		recordExampleCases(
			{
				unitId: 'audit.clean-code-files',
				symbol: 'readReviewInput',
				state: 'throws-invalidreviewinputerror-for-outside-paths',
				evidence: 'examples-cases',
				file: 'throws-invalidreviewinputerror-for-outside-paths.json'
			},
			[{ name: 'outside file', input: { root, path }, error }]
		);
	});
});

test('Throws InvalidReviewInputError for symlinks', async () => {
	await withTempDir('clean-code-review-symlink-', async (root) => {
		const target = 'target.ts';
		const path = 'linked.ts';
		await writeFile(join(root, target), 'source');
		await symlink(join(root, target), join(root, path));
		let error: { name: string; message: string } | undefined;
		try {
			await readReviewInput(root, path);
		} catch (caught) {
			error = { name: (caught as Error).name, message: (caught as Error).message };
		}
		expect(error?.name).toBe('InvalidReviewInputError');
		expect(error?.message).toBe('Review input is outside the project or is a symlink.');
		recordExampleCases(
			{
				unitId: 'audit.clean-code-files',
				symbol: 'readReviewInput',
				state: 'throws-invalidreviewinputerror-for-symlinks',
				evidence: 'examples-cases',
				file: 'throws-invalidreviewinputerror-for-symlinks.json'
			},
			[{ name: 'symlink to contained file', input: { root, path }, error }]
		);
	});
});

test('Throws InvalidReviewInputError for files over 1 MiB', async () => {
	await withTempDir('clean-code-review-size-', async (root) => {
		const path = 'large.ts';
		await writeFile(join(root, path), 'x'.repeat(1024 * 1024 + 1));
		let error: { name: string; message: string } | undefined;
		try {
			await readReviewInput(root, path);
		} catch (caught) {
			error = { name: (caught as Error).name, message: (caught as Error).message };
		}
		expect(error?.name).toBe('InvalidReviewInputError');
		expect(error?.message).toBe('Review input exceeds the supported size.');
		recordExampleCases(
			{
				unitId: 'audit.clean-code-files',
				symbol: 'readReviewInput',
				state: 'throws-invalidreviewinputerror-for-files-over-1-mib',
				evidence: 'examples-cases',
				file: 'throws-invalidreviewinputerror-for-files-over-1-mib.json'
			},
			[{ name: 'file one byte over limit', input: { root, path }, error }]
		);
	});
});
