import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { recordResponse, recordCleanCode } from '../../src/workflows/agents-providers/recordJevAnalytics';
import type { ResponseCheckReport } from '../../src/core/verification-evidence/responseCheckTypes';
import type { CleanCodeReport } from '../../src/audit/development-tooling/cleanCodeTypes';

const responseReport: ResponseCheckReport = {
	status: 'dry-run',
	mode: 'advisory',
	rubricVersion: 'response-check-v1',
	requestedModel: 'jev-1.13.0',
	minConfidence: 0.85,
	inputHashes: {
		request: 'de9740dc25a22fef9a9389a8b47cbd0fcf734ec597a7264f6e49818942c53fb3',
		response: 'e0a98e03046cd94e02d0fb22ff958a3c0069f4a7b82df23d8a264d4e786c5544',
		context: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		criteria: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
	},
	checks: [],
	coverage: ['fulfillment', 'completeness', 'constraints', 'relevance'],
	usage: { input_tokens: 0, output_tokens: 0 }
};

const cleanCodeReport: CleanCodeReport = {
	mode: 'advisory',
	status: 'incomplete',
	rubricVersion: 'clean-code-v1',
	requestedModel: 'jev-1.13.0',
	minConfidence: 0.85,
	coverage: {
		selectedFiles: ['src/workflows/agents-providers/recordJevAnalytics.ts'],
		excludedPaths: [],
		unsupportedFiles: []
	},
	files: [
		{
			path: 'src/workflows/agents-providers/recordJevAnalytics.ts',
			contentHash: '',
			contextHash: '',
			status: 'incomplete',
			assessments: [],
			contextPaths: [],
			omittedContext: [],
			cached: false,
			usage: { input_tokens: 0, output_tokens: 0 },
			error: 'Jev review was cancelled.'
		}
	],
	usage: { input_tokens: 0, output_tokens: 0 }
};

async function withAnalyticsDisabled<T>(use: () => Promise<T>): Promise<T> {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
	try {
		return await use();
	} finally {
		vi.unstubAllEnvs();
	}
}

test('Records a dry-run response check without persisting analytics', async () => {
	await withTempDir('record-jev-response-', async () => {
		const result = await withAnalyticsDisabled(() =>
			recordResponse(responseReport, {}, 1842)
		);

		expect(result).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'workflow.record-jev-analytics',
				symbol: 'recordResponse',
				state: 'records-a-dry-run-response-check-without-persisting-analytic',
				evidence: 'examples-cases',
				file: 'records-a-dry-run-response-check-without-persisting-analytic.json'
			},
			[
				{
					name: 'dry-run response report resolves with no value when analytics is disabled',
					input: { report: responseReport, context: {}, durationMs: 1842 },
					output: null
				}
			]
		);
	});
});

test('Records an incomplete clean-code review for a project root', async () => {
	await withTempRepo(async (repository) => {
		const result = await withAnalyticsDisabled(() =>
			recordCleanCode(cleanCodeReport, {}, { root: repository.root, durationMs: 2350 })
		);

		expect(result).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'workflow.record-jev-analytics',
				symbol: 'recordCleanCode',
				state: 'records-an-incomplete-clean-code-review-for-a-project-root',
				evidence: 'examples-cases',
				file: 'records-an-incomplete-clean-code-review-for-a-project-root.json'
			},
			[
				{
					name: 'incomplete clean-code report resolves with no value when analytics is disabled',
					input: { report: cleanCodeReport, context: {}, timing: { durationMs: 2350 } },
					output: null
				}
			]
		);
	});
});
