import { test } from 'vitest';
import { codeAudit } from '../../src/services/verification-evidence/task-completion-service/codeAudit';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Rejects when no verification record exists for the commit', async () => {
	await withTempDir('code-audit-missing-record-', async (root) => {
		const commit = '9f2c4e1b7a03d5c8e61f2b9a4d07c3e5b8a16d20';
		let error: unknown;
		try {
			await codeAudit(root, commit, []);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(
			'Run harness verify run; no verification record proves the task commit.'
		);
		recordExampleCases(
			{
				unitId: 'service.task-completion-service-code-audit',
				symbol: 'codeAudit',
				state: 'rejects-when-no-verification-record-exists-for-the-commit',
				evidence: 'examples-cases',
				file: 'rejects-when-no-verification-record-exists-for-the-commit.json'
			},
			[
				{
					name: 'missing commit record is rejected before verification checks',
					input: { root, commit, requested: [] },
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
