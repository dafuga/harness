import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	maxReviewStateBytes,
	snapshotCleanCodeFile
} from '../../src/audit/verification-evidence/cleanCodeSnapshot';
import { ReviewContextBudgetExceededError } from '../../src/audit/verification-evidence/cleanCodeSnapshot.types';

async function writeTarget(root: string, contents: string): Promise<void> {
	const directory = join(root, 'src');
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'example.ts'), contents);
}

test('Snapshots a target and keeps only its findings', async () => {
	await withTempDir('clean-code-snapshot-', async (root) => {
		const contents = 'export const answer = 42;\n';
		await writeTarget(root, contents);
		const input = {
			root,
			path: 'src/example.ts',
			files: [],
			findings: [
				{ path: 'src/example.ts', rule: 'complexity', message: 'Simplify this function.' },
				{ path: 'src/other.ts', rule: 'unused', message: 'Not part of this target.' }
			]
		};
		const snapshot = await snapshotCleanCodeFile(input);
		const state = JSON.parse(snapshot.state) as {
			target: { path: string; language: string; code: string };
			auditFindings: Array<{ path: string; rule: string }>;
		};
		expect(maxReviewStateBytes).toBe(24000);
		expect(state.target).toEqual({ path: input.path, language: '.ts', code: contents });
		expect(state.auditFindings).toEqual([{ path: input.path, rule: 'complexity', message: 'Simplify this function.' }]);
		expect(snapshot.inputs).toHaveLength(1);
		recordExampleCases(
			{
				unitId: 'audit.clean-code-snapshot',
				symbol: 'snapshotCleanCodeFile',
				state: 'snapshots-a-target-and-keeps-only-its-findings',
				evidence: 'examples-cases',
				file: 'snapshots-a-target-and-keeps-only-its-findings.json'
			},
			[
				{
					name: 'target with one matching and one unrelated finding',
					input: { path: input.path, code: contents, findings: input.findings },
					output: {
						target: state.target,
						auditFindings: state.auditFindings,
						contextPaths: snapshot.contextPaths,
						inputCount: snapshot.inputs.length
					}
				}
			]
		);
	});
});

test('Rejects a target larger than the review state budget', async () => {
	await withTempDir('clean-code-snapshot-large-', async (root) => {
		await writeTarget(root, 'x'.repeat(maxReviewStateBytes + 1));
		const input = { root, path: 'src/example.ts', files: [], findings: [] };
		let error: unknown;
		try {
			await snapshotCleanCodeFile(input);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ReviewContextBudgetExceededError);
		expect((error as Error).message).toBe(
			'Target exceeds the bounded review context; no code was truncated.'
		);
		recordExampleCases(
			{
				unitId: 'audit.clean-code-snapshot',
				symbol: 'snapshotCleanCodeFile',
				state: 'rejects-a-target-larger-than-the-review-state-budget',
				evidence: 'examples-cases',
				file: 'rejects-a-target-larger-than-the-review-state-budget.json'
			},
			[
				{
					name: 'oversized target',
					input: { path: input.path, codeBytes: maxReviewStateBytes + 1 },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
