import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	responseInputLimit,
	responseCheckSettings,
	readResponseCheckInput,
	responseInputHashes
} from '../../src/cli/program/responseCheckInput';

type ResponseOptions = Parameters<typeof responseCheckSettings>[0];
type ErrorCase = { name: string; input: unknown; error: unknown };

const unitId = 'workflow.response-check-input';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

async function errorOf(work: () => unknown): Promise<Error | undefined> {
	try {
		await work();
		return undefined;
	} catch (error) {
		return error as Error;
	}
}

function writeInputFiles(directory: string, request: string, response: string): ResponseOptions {
	writeFileSync(join(directory, 'request.txt'), request);
	writeFileSync(join(directory, 'response.txt'), response);
	return { request: join(directory, 'request.txt'), response: join(directory, 'response.txt') };
}

test('Builds validated settings from options', () => {
	const reviewOptions = { model: 'jev-1.13.0', minConfidence: '0.9', apiKeyEnv: 'REVIEW_JEV_API_KEY' };
	const defaults = responseCheckSettings({});
	const review = responseCheckSettings(reviewOptions);

	expect(defaults).toEqual({ model: 'jev-1.13.0', minConfidence: 0.85, apiKeyEnv: 'HARNESS_JEV_API_KEY' });
	expect(review).toEqual({ model: 'jev-1.13.0', minConfidence: 0.9, apiKeyEnv: 'REVIEW_JEV_API_KEY' });
	recordExampleCases(
		{ unitId, symbol: 'responseCheckSettings', state: 'builds-validated-settings-from-options', evidence: 'examples-cases', file: 'builds-validated-settings-from-options.json' },
		[
			{ name: 'no options fall back to the defaults', input: {}, output: defaults },
			{ name: 'review settings keep their explicit values', input: reviewOptions, output: review }
		]
	);
});

test('Rejects invalid settings values', async () => {
	const invalid = [
		{ name: 'model without the jev prefix', options: { model: 'gpt-4' }, message: 'Invalid JEV model.' },
		{ name: 'confidence above one', options: { minConfidence: '1.5' }, message: 'Confidence threshold must be greater than 0 and at most 1.' },
		{ name: 'lowercase api key variable', options: { apiKeyEnv: 'review_key' }, message: 'Invalid API key environment variable.' }
	];
	const cases: ErrorCase[] = [];
	for (const item of invalid) {
		const error = await errorOf(() => responseCheckSettings(item.options));
		expect(error?.message).toBe(item.message);
		cases.push({ name: item.name, input: item.options, error: { name: error?.name, message: error?.message } });
	}
	recordExampleCases(
		{ unitId, symbol: 'responseCheckSettings', state: 'rejects-invalid-settings-values', evidence: 'examples-cases', file: 'rejects-invalid-settings-values.json' },
		cases
	);
});

test('Reads request, response, context and criteria into the input', async () => {
	await withTempDir('response-check-read-', async (directory) => {
		const options = writeInputFiles(directory, 'Summarize the check.', 'The table rendered no rows.');
		writeFileSync(join(directory, 'context.md'), 'Release 4.2 notes for the checkout service.');
		const withContext: ResponseOptions = { ...options, context: join(directory, 'context.md') };
		const bare = await readResponseCheckInput(options);
		const full = await readResponseCheckInput(withContext);

		expect(bare).toEqual({ request: 'Summarize the check.', response: 'The table rendered no rows.', context: '', criteria: [] });
		expect(full.context).toBe('Release 4.2 notes for the checkout service.');
		recordExampleCases(
			{ unitId, symbol: 'readResponseCheckInput', state: 'reads-request-response-context-and-criteria-into-the-input', evidence: 'examples-cases', file: 'reads-request-response-context-and-criteria-into-the-input.json' },
			[
				{ name: 'request and response only leave context empty and criteria empty', input: options, output: bare },
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
			{ unitId, symbol: 'readResponseCheckInput', state: 'rejects-missing-or-blank-request-input', evidence: 'examples-cases', file: 'rejects-missing-or-blank-request-input.json' },
			[
				{ name: 'whitespace-only request is rejected as blank', input: blank, error: { name: blankError?.name, message: blankError?.message } },
				{ name: 'missing response path is rejected', input: missing, error: { name: missingError?.name, message: missingError?.message } }
			]
		);
	});
});

test('Rejects input beyond the 24000 byte limit', async () => {
	await withTempDir('response-check-limit-', async (directory) => {
		const oversized = writeInputFiles(directory, 'a'.repeat(responseInputLimit + 1), 'ok');
		const fileError = await errorOf(() => readResponseCheckInput(oversized));
		const overflow = writeInputFiles(directory, 'a'.repeat(12000), 'a'.repeat(12000));
		const totalError = await errorOf(() => readResponseCheckInput(overflow));

		expect(responseInputLimit).toBe(24000);
		expect(fileError?.message).toBe('Cannot read input file: use a regular UTF-8 file of at most 24000 bytes.');
		expect(totalError?.message).toBe('Serialized evaluation input exceeds 24000 UTF-8 bytes; no input was truncated.');
		recordExampleCases(
			{ unitId, symbol: 'readResponseCheckInput', state: 'rejects-input-beyond-the-24000-byte-limit', evidence: 'examples-cases', file: 'rejects-input-beyond-the-24000-byte-limit.json' },
			[
				{ name: 'request file of 24001 bytes is unreadable', input: { limit: responseInputLimit, requestBytes: responseInputLimit + 1 }, error: { name: fileError?.name, message: fileError?.message } },
				{ name: 'two 12000 byte files serialize above the limit', input: { requestBytes: 12000, responseBytes: 12000 }, error: { name: totalError?.name, message: totalError?.message } }
			]
		);
	});
});

test('Hashes each input field with SHA-256', () => {
	const input = { request: 'Does the release note mention the migration?', response: 'Yes, the release note has a migration section.', context: '', criteria: [] };
	const hashes = responseInputHashes(input);

	expect(hashes.context).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	expect(hashes.criteria).toBe(sha256('[]'));
	expect(hashes.request).toBe(sha256(input.request));
	recordExampleCases(
		{ unitId, symbol: 'responseInputHashes', state: 'hashes-each-input-field-with-sha-256', evidence: 'examples-cases', file: 'hashes-each-input-field-with-sha-256.json' },
		[{ name: 'string fields hash their text and criteria hashes its JSON', input, output: hashes }]
	);
});
