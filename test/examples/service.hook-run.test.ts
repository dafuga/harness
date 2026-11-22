import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { HookRunService } from '../../src/cli/program/hook-run-service/HookRunService';
import type { HookOutcome } from '../../src/cli/program/hook-run-service/HookRunService.types';

const EMPTY_PUSH_INPUT = '';

test('Returns no verified or blocked commits for an empty pre-push', async () => {
	await withTempDir('hook-run-empty-push-', async (directory) => {
		const service = new HookRunService(directory);
		const outcome: HookOutcome = await service.prePush(EMPTY_PUSH_INPUT);

		expect(outcome).toEqual({ verified: [], blocked: [] });
		recordExampleCases(
			{
				unitId: 'service.hook-run',
				symbol: 'HookRunService.prePush',
				state: 'returns-no-verified-or-blocked-commits-for-an-empty-pre-push',
				evidence: 'examples-cases',
				file: 'returns-no-verified-or-blocked-commits-for-an-empty-pre-push.json'
			},
			[
				{
					name: 'empty pre-push input selects no commits',
					input: { root: 'temporary directory', input: EMPTY_PUSH_INPUT },
					output: outcome
				}
			]
		);
	});
});
