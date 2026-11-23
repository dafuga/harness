import type { Row } from './workflow.run-response-check.test.types';
import type {
	ResponseCheckOptions,
	ResponseCheckStatus
} from '../../src/core/verification-evidence/responseCheckTypes';
import { toOptions, credential } from './workflow.run-response-check.fixtures';

/** Dry runs, an empty response, and the inputs and settings a caller can get wrong, as the caller passes them. */
export function caseRows(directory: string): Row[] {
	const pair = { request: 'request', response: 'response' };
	const row = bindRow(directory);
	return [...validationRows(row, pair), ...inputRows(row, pair)];
}

function bindRow(directory: string) {
	return (
		name: string,
		spec: ResponseCheckOptions,
		status: ResponseCheckStatus,
		error?: string
	): Row => ({ name, input: spec, options: toOptions(spec, directory), status, error });
}

function validationRows(row: ReturnType<typeof bindRow>, pair: ResponseCheckOptions): Row[] {
	return [
		row('dry run of a request and a response', { ...pair, dryRun: true }, 'dry-run'),
		row(
			'dry run with context and criteria in gate mode',
			{ ...pair, context: 'context', criteria: 'criteria', dryRun: true, gate: true },
			'dry-run'
		),
		row(
			'empty response with an acceptance criterion',
			{ request: 'request', response: 'empty', criteria: 'criteria' },
			'violations'
		),
		row(
			'no request file',
			{ response: 'response' },
			'incomplete',
			'--request and --response files are required.'
		),
		row(
			'model outside the JEV family',
			{ ...pair, model: 'gpt-4o' },
			'incomplete',
			'Invalid JEV model.'
		),
		row(
			'minConfidence above one',
			{ ...pair, minConfidence: '1.5' },
			'incomplete',
			'Confidence threshold must be greater than 0 and at most 1.'
		)
	];
}

function inputRows(row: ReturnType<typeof bindRow>, pair: ResponseCheckOptions): Row[] {
	return [
		row(
			'apiKeyEnv in lower case',
			{ ...pair, apiKeyEnv: 'jev_key' },
			'incomplete',
			'Invalid API key environment variable.'
		),
		row(
			'request file that does not exist',
			{ ...pair, request: 'missing' },
			'incomplete',
			'Cannot read input file: use a regular UTF-8 file of at most 24000 bytes.'
		),
		row(
			'blank request',
			{ ...pair, request: 'blank' },
			'incomplete',
			'The user request must be nonempty.'
		),
		row(
			'criteria file that is not JSON',
			{ ...pair, criteria: 'bad-criteria' },
			'incomplete',
			'Criteria file must contain valid JSON.'
		),
		row(
			'criteria that is not a JSON array',
			{ ...pair, criteria: 'object-criteria' },
			'incomplete',
			'Criteria must be a JSON array.'
		),
		row(
			'input over the serialized limit',
			{ request: 'long', response: 'long' },
			'incomplete',
			'Serialized evaluation input exceeds 24000 UTF-8 bytes; no input was truncated.'
		),
		row(
			'assessment without a credential',
			{ ...pair, apiKeyEnv: credential },
			'incomplete',
			'Missing project-owned JEV credential in the selected environment variable.'
		)
	];
}
