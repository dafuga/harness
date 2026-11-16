import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { TrustedBaseService } from '../../src/workflows/verification-evidence/run-verify/TrustedBaseService';

test('Returns null when no verification record exists', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'fixture');
		const from = git('rev-parse', 'HEAD');
		const service = new TrustedBaseService(root);
		const result = await service.nearestRecord(from);
		expect(result).toBeNull();
		recordExampleCases(
			{
				unitId: 'service.trusted-base',
				symbol: 'nearestRecord',
				state: 'returns-null-when-no-verification-record-exists',
				evidence: 'examples-cases',
				file: 'returns-null-when-no-verification-record-exists.json'
			},
			[
				{
					name: 'a committed revision without verification evidence has no trusted base',
					input: { from },
					output: result
				}
			]
		);
	});
});
