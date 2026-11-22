import { test } from 'vitest';
import type {
	ResponseAssessment,
	ResponseCheckOptions,
	ResponseCheckReport
} from '../../src/core/verification-evidence/responseCheckTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const gatedOptions = {
	request: 'Summarise the release notes',
	response: 'Three fixes shipped in 2.4.0',
	criteria: 'accuracy,tone',
	minConfidence: '0.8',
	gate: true,
	dryRun: false
} satisfies ResponseCheckOptions;

const bareOptions = {
	request: 'Summarise the release notes',
	json: true
} satisfies ResponseCheckOptions;

const accuracyAssessment = {
	id: 'accuracy',
	title: 'Accuracy',
	type: 'choice',
	choice: 'meets',
	confidence: 0.92,
	probabilities: { meets: 0.92, violates: 0.05, 'needs-review': 0.03 },
	status: 'meets',
	guidance: 'Every release note is supported by the request context.'
} satisfies ResponseAssessment;

const satisfiedReport = {
	status: 'satisfied',
	mode: 'gate',
	rubricVersion: 'rubric-1',
	requestedModel: 'fixture-model',
	model: 'fixture-model',
	minConfidence: 0.8,
	inputHashes: { request: 'sha256:req', response: 'sha256:res' },
	checks: [accuracyAssessment],
	coverage: ['accuracy'],
	usage: { input_tokens: 120, output_tokens: 36 }
} satisfies ResponseCheckReport;

test('Options carry optional gate and dry-run settings', () => {
	expect(gatedOptions.gate).toBe(true);
	expect(gatedOptions.dryRun).toBe(false);
	expect(bareOptions).toEqual({
		request: 'Summarise the release notes',
		json: true
	});
	recordExampleCases(
		{
			unitId: 'function.response-check-types',
			symbol: 'ResponseCheckOptions',
			state: 'options-carry-optional-gate-and-dry-run-settings',
			evidence: 'examples-cases',
			file: 'options-carry-optional-gate-and-dry-run-settings.json'
		},
		[
			{
				name: 'gated run with criteria, confidence and dry-run off',
				input: gatedOptions,
				output: {
					gate: true,
					dryRun: false,
					minConfidence: '0.8',
					criteria: 'accuracy,tone'
				}
			},
			{
				name: 'bare run with only request and json output',
				input: bareOptions,
				output: { request: 'Summarise the release notes', json: true }
			}
		]
	);
});

test('Reports keep the outcome status and token usage', () => {
	expect(satisfiedReport).toMatchObject({ status: 'satisfied', mode: 'gate' });
	expect(satisfiedReport.checks[0]?.status).toBe('meets');
	expect(satisfiedReport.usage).toEqual({ input_tokens: 120, output_tokens: 36 });
	recordExampleCases(
		{
			unitId: 'function.response-check-types',
			symbol: 'ResponseCheckReport',
			state: 'reports-keep-the-outcome-status-and-token-usage',
			evidence: 'examples-cases',
			file: 'reports-keep-the-outcome-status-and-token-usage.json'
		},
		[
			{
				name: 'gate run satisfies the accuracy criterion',
				input: { mode: 'gate', criteria: ['accuracy'] },
				output: {
					status: 'satisfied',
					mode: 'gate',
					checks: [{ id: 'accuracy', status: 'meets', confidence: 0.92 }],
					usage: { input_tokens: 120, output_tokens: 36 }
				}
			}
		]
	);
});
