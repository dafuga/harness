import type { ResponseOptions, ErrorCase } from './workflow.response-check-input.test.types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	responseCheckSettings,
	readResponseCheckInput
} from '../../src/cli/program/responseCheckInput';
import {
	unitId,
	errorOf,
	writeInputFiles,
	boundedResponseInputExample,
	responseInputHashesExample
} from './workflow.response-check-input.fixtures';

test('Builds validated settings from options', () => {
	const reviewOptions = {
		model: 'jev-1.13.0',
		minConfidence: '0.9',
		apiKeyEnv: 'REVIEW_JEV_API_KEY'
	};
	const defaults = responseCheckSettings({});
	const review = responseCheckSettings(reviewOptions);

	expect(defaults).toEqual({
		model: 'jev-1.13.0',
		minConfidence: 0.85,
		apiKeyEnv: 'HARNESS_JEV_API_KEY'
	});
	expect(review).toEqual({
		model: 'jev-1.13.0',
		minConfidence: 0.9,
		apiKeyEnv: 'REVIEW_JEV_API_KEY'
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'responseCheckSettings',
			state: 'builds-validated-settings-from-options',
			evidence: 'examples-cases',
			file: 'builds-validated-settings-from-options.json'
		},
		[
			{ name: 'no options fall back to the defaults', input: {}, output: defaults },
			{ name: 'review settings keep their explicit values', input: reviewOptions, output: review }
		]
	);
});

test('Rejects invalid settings values', async () => {
	const invalid = [
		{
			name: 'model without the jev prefix',
			options: { model: 'gpt-4' },
			message: 'Invalid JEV model.'
		},
		{
			name: 'confidence above one',
			options: { minConfidence: '1.5' },
			message: 'Confidence threshold must be greater than 0 and at most 1.'
		},
		{
			name: 'lowercase api key variable',
			options: { apiKeyEnv: 'review_key' },
			message: 'Invalid API key environment variable.'
		}
	];
	const cases: ErrorCase[] = [];
	for (const item of invalid) {
		const error = await errorOf(() => responseCheckSettings(item.options));
		expect(error?.message).toBe(item.message);
		cases.push({
			name: item.name,
			input: item.options,
			error: { name: error?.name, message: error?.message }
		});
	}
	recordExampleCases(
		{
			unitId,
			symbol: 'responseCheckSettings',
			state: 'rejects-invalid-settings-values',
			evidence: 'examples-cases',
			file: 'rejects-invalid-settings-values.json'
		},
		cases
	);
});

test('Reads request, response, context and criteria into the input', async () => {
	await withTempDir('response-check-read-', async (directory) => {
		const options = writeInputFiles(
			directory,
			'Summarize the check.',
			'The table rendered no rows.'
		);
		writeFileSync(join(directory, 'context.md'), 'Release 4.2 notes for the checkout service.');
		const withContext: ResponseOptions = { ...options, context: join(directory, 'context.md') };
		const bare = await readResponseCheckInput(options);
		const full = await readResponseCheckInput(withContext);

		expect(bare).toEqual({
			request: 'Summarize the check.',
			response: 'The table rendered no rows.',
			context: '',
			criteria: []
		});
		expect(full.context).toBe('Release 4.2 notes for the checkout service.');
		recordExampleCases(
			{
				unitId,
				symbol: 'readResponseCheckInput',
				state: 'reads-request-response-context-and-criteria-into-the-input',
				evidence: 'examples-cases',
				file: 'reads-request-response-context-and-criteria-into-the-input.json'
			},
			[
				{
					name: 'request and response only leave context empty and criteria empty',
					input: options,
					output: bare
				},
				{ name: 'a context file fills the context field', input: withContext, output: full }
			]
		);
	});
});

test('Rejects missing or blank request input', async () => {
	await withTempDir('response-check-blank-', async (directory) => {
		const blank = writeInputFiles(directory, '   \n', 'The table rendered no rows.');
		const missing: ResponseOptions = { request: join(directory, 'request.txt') };
		const blankError = await errorOf(() => readResponseCheckInput(blank));
		const missingError = await errorOf(() => readResponseCheckInput(missing));

		expect(blankError?.message).toBe('The user request must be nonempty.');
		expect(missingError?.message).toBe('--request and --response files are required.');
		recordExampleCases(
			{
				unitId,
				symbol: 'readResponseCheckInput',
				state: 'rejects-missing-or-blank-request-input',
				evidence: 'examples-cases',
				file: 'rejects-missing-or-blank-request-input.json'
			},
			[
				{
					name: 'whitespace-only request is rejected as blank',
					input: blank,
					error: { name: blankError?.name, message: blankError?.message }
				},
				{
					name: 'missing response path is rejected',
					input: missing,
					error: { name: missingError?.name, message: missingError?.message }
				}
			]
		);
	});
});

test('Rejects input beyond the 24000 byte limit', boundedResponseInputExample);

test('Hashes each input field with SHA-256', responseInputHashesExample);
