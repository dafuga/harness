import { test } from 'vitest';
import { reviewCleanCode } from '../../src/audit/development-tooling/reviewCleanCode';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import type { ReviewCleanCodeInput } from '../../src/audit/development-tooling/reviewCleanCode.types';

const settings: ReviewCleanCodeInput['settings'] = {
	mode: 'advisory',
	model: 'jev-model',
	minConfidence: 0.8,
	apiKeyEnv: 'JEV_API_KEY',
	exclude: []
};

test('Returns a dry-run report without evaluating files', async () => {
	await withTempDir('review-clean-code-dry-run-', async (directory) => {
		const input: ReviewCleanCodeInput = {
			root: directory,
			settings,
			options: { dryRun: true },
			evaluate: async () => {
				throw new Error('Dry run must not evaluate files.');
			}
		};
		const report = await reviewCleanCode(input);

		expect(report.status).toBe('dry-run');
		expect(report.mode).toBe('advisory');
		expect(report.requestedModel).toBe('jev-model');
		expect(report.minConfidence).toBe(0.8);
		expect(report.files).toEqual([]);
		expect(report.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
		recordExampleCases(
			{
				unitId: 'workflow.review-clean-code',
				symbol: 'reviewCleanCode',
				state: 'returns-a-dry-run-report-without-evaluating-files',
				evidence: 'examples-cases',
				file: 'returns-a-dry-run-report-without-evaluating-files.json'
			},
			[
				{
					name: 'dry run reports discovered coverage and zero usage',
					input: { settings, options: { dryRun: true } },
					output: {
						status: report.status,
						mode: report.mode,
						requestedModel: report.requestedModel,
						minConfidence: report.minConfidence,
						coverage: report.coverage,
						files: report.files,
						usage: report.usage
					}
				}
			]
		);
	});
});
