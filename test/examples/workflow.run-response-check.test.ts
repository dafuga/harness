import type { Captured, Row } from './workflow.run-response-check.test.types';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { checkResponse, renderResponseCheck, responseCheckExitCode, runResponseCheck } from '../../src/cli/program/runResponseCheck';
import type { ResponseAssessment, ResponseCheckOptions, ResponseCheckReport, ResponseCheckStatus } from '../../src/core/verification-evidence/responseCheckTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unit = 'workflow.run-response-check';
const requestText = 'Summarise the release notes in three bullet points for the support team.';
const responseText = '- Adds response checks\n- Fixes report IDs\n- Documents the exit codes';
const criteriaText = '[{"id":"cite-sources","description":"Cite a source for each factual claim."}]';
const credential = 'HARNESS_RESPONSE_CHECK_TEST_KEY';
const standardIds = ['fulfillment', 'completeness', 'constraints', 'relevance'];
const disclaimer = 'This assessment covers supplied text only; model confidence is not calibrated correctness.';
const texts: Record<string, string> = {
	fulfillment: 'Answer the actual user request rather than a different task or a promise to do it later.',
	completeness: 'Include each requested deliverable and address every requested part.',
	constraints: 'Follow the user’s explicit constraints and requested output format.',
	relevance: 'Keep the answer focused on material that helps fulfill the request.',
	'custom:cite-sources': 'Revise the answer to satisfy acceptance criterion cite-sources.'
};
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** A check as the evaluator returns it: the chosen label carries the confidence, the rest share the remainder. */
function assessed(id: string, title: string, status: ResponseAssessment['status'], confidence: number): ResponseAssessment {
	const choice = status === 'needs-review' ? 'insufficient_context' : status;
	const rest = Math.round(((1 - confidence) / 2) * 100) / 100;
	const probabilities = { meets: rest, violates: rest, insufficient_context: rest, [choice]: confidence };
	return { type: 'choice', choice, confidence, probabilities, id, title, status, guidance: texts[id] };
}

const base: ResponseCheckReport = { status: 'satisfied', mode: 'advisory', rubricVersion: 'response-check-v1', requestedModel: 'jev-1.13.0', model: 'jev-1.13.0', minConfidence: 0.85, inputHashes: {}, checks: [], coverage: [], usage: { input_tokens: 1512, output_tokens: 296 } };
const reportOf = (overrides: Partial<ResponseCheckReport>): ResponseCheckReport => ({ ...base, ...overrides });
const violations = reportOf({
	status: 'violations', mode: 'gate', minConfidence: 0.9, coverage: [...standardIds, 'custom:cite-sources'],
	checks: [
		assessed('fulfillment', 'Task fulfillment', 'meets', 0.96),
		assessed('completeness', 'Completeness', 'violates', 0.94),
		assessed('constraints', 'Explicit constraints', 'meets', 0.92),
		assessed('relevance', 'Relevance', 'meets', 0.97),
		assessed('custom:cite-sources', 'Acceptance criterion: cite-sources', 'needs-review', 0.62)
	]
});
const incomplete = reportOf({ status: 'incomplete', model: undefined, usage: { input_tokens: 0, output_tokens: 0 }, error: '--request and --response files are required.' });
const violationsText = `Response check: violations (gate)\nModel: jev-1.13.0; rubric: response-check-v1\nConfidence threshold: 0.9\nCoverage: fulfillment, completeness, constraints, relevance, custom:cite-sources\n[meets] Task fulfillment (0.96)\n  ${texts.fulfillment}\n[violates] Completeness (0.94)\n  ${texts.completeness}\n[meets] Explicit constraints (0.92)\n  ${texts.constraints}\n[meets] Relevance (0.97)\n  ${texts.relevance}\n[needs-review] Acceptance criterion: cite-sources (0.62)\n  ${texts['custom:cite-sources']}\n${disclaimer}`;
const incompleteText = `Response check: incomplete (advisory)\nModel: jev-1.13.0; rubric: response-check-v1\nConfidence threshold: 0.85\nCoverage: none\nError: --request and --response files are required.\n${disclaimer}`;

function writeFiles(directory: string, files: Record<string, string>): void {
	for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
}

/** Options as a caller passes them: each file named in the spec is a file in the temporary directory. */
function toOptions(spec: ResponseCheckOptions, directory: string): ResponseCheckOptions {
	const at = (name?: string) => (name === undefined ? undefined : join(directory, name));
	return { ...spec, request: at(spec.request), response: at(spec.response), context: at(spec.context), criteria: at(spec.criteria) };
}

async function withEnv<T>(values: Record<string, string>, use: () => Promise<T>): Promise<T> {
	for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
	try {
		return await use();
	} finally {
		vi.unstubAllEnvs();
	}
}

/** Runs the command with console output captured. Analytics fields are blank so the caller's HARNESS_ANALYTICS_* values do not apply. */
async function runCaptured(directory: string, spec: ResponseCheckOptions): Promise<Captured> {
	const lines: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((line: string) => {
		lines.push(line);
	});
	const previous = process.exitCode;
	process.exitCode = undefined;
	try {
		await runResponseCheck({ loop: '', step: '', task: '', report: '', ...toOptions(spec, directory) });
		return { printed: lines.join('\n'), exitCode: process.exitCode };
	} catch (error) {
		const failure = error as Error;
		const message = failure.message.split(directory).join('<reports-home>');
		return { printed: lines.join('\n'), exitCode: process.exitCode, error: { name: failure.name, message } };
	} finally {
		log.mockRestore();
		process.exitCode = previous;
	}
}

/** Runs the commands one after another: the console and the exit code are shared, so runs cannot overlap. */
async function runInOrder(directory: string, inputs: ResponseCheckOptions[]): Promise<Captured[]> {
	const done: Captured[] = [];
	for (const input of inputs) done.push(await runCaptured(directory, input));
	return done;
}

/** Dry runs, an empty response, and the inputs and settings a caller can get wrong, as the caller passes them. */
function caseRows(directory: string): Row[] {
	const pair = { request: 'request', response: 'response' };
	const row = (name: string, spec: ResponseCheckOptions, status: ResponseCheckStatus, error?: string): Row => ({ name, input: spec, options: toOptions(spec, directory), status, error });
	return [
		row('dry run of a request and a response', { ...pair, dryRun: true }, 'dry-run'),
		row('dry run with context and criteria in gate mode', { ...pair, context: 'context', criteria: 'criteria', dryRun: true, gate: true }, 'dry-run'),
		row('empty response with an acceptance criterion', { request: 'request', response: 'empty', criteria: 'criteria' }, 'violations'),
		row('no request file', { response: 'response' }, 'incomplete', '--request and --response files are required.'),
		row('model outside the JEV family', { ...pair, model: 'gpt-4o' }, 'incomplete', 'Invalid JEV model.'),
		row('minConfidence above one', { ...pair, minConfidence: '1.5' }, 'incomplete', 'Confidence threshold must be greater than 0 and at most 1.'),
		row('apiKeyEnv in lower case', { ...pair, apiKeyEnv: 'jev_key' }, 'incomplete', 'Invalid API key environment variable.'),
		row('request file that does not exist', { ...pair, request: 'missing' }, 'incomplete', 'Cannot read input file: use a regular UTF-8 file of at most 24000 bytes.'),
		row('blank request', { ...pair, request: 'blank' }, 'incomplete', 'The user request must be nonempty.'),
		row('criteria file that is not JSON', { ...pair, criteria: 'bad-criteria' }, 'incomplete', 'Criteria file must contain valid JSON.'),
		row('criteria that is not a JSON array', { ...pair, criteria: 'object-criteria' }, 'incomplete', 'Criteria must be a JSON array.'),
		row('input over the serialized limit', { request: 'long', response: 'long' }, 'incomplete', 'Serialized evaluation input exceeds 24000 UTF-8 bytes; no input was truncated.'),
		row('assessment without a credential', { ...pair, apiKeyEnv: credential }, 'incomplete', 'Missing project-owned JEV credential in the selected environment variable.')
	];
}

test('checkResponse returns dry-run, assessed and incomplete reports without a model call', async () => {
	await withTempDir('response-check-reports-', async (directory) => {
		writeFiles(directory, { request: requestText, response: responseText, context: 'Earlier notes for the support team.', criteria: criteriaText, empty: '', blank: '  \n', 'bad-criteria': '{not json', 'object-criteria': '{"id":"cite-sources","description":"Cite a source."}', long: 'a'.repeat(12000) });
		const rows = caseRows(directory);
		const reports = await withEnv({ [credential]: '' }, () => Promise.all(rows.map(({ options }) => checkResponse(options))));
		expect(reports[0].inputHashes).toEqual({ request: sha256(requestText), response: sha256(responseText), context: sha256(''), criteria: sha256('[]') });
		expect(reports[1].coverage).toEqual([...standardIds, 'custom:cite-sources']);
		expect(reports[2].checks.map(({ status }) => status)).toEqual(['violates', 'needs-review', 'needs-review', 'needs-review', 'needs-review']);
		expect(reports.map(({ status, error }) => [status, error])).toEqual(rows.map(({ status, error }) => [status, error]));
		recordExampleCases(
			{ unitId: unit, symbol: 'checkResponse', state: 'checkresponse-returns-dry-run-assessed-and-incomplete-report', evidence: 'examples-cases', file: 'checkresponse-returns-dry-run-assessed-and-incomplete-report.json' },
			rows.map(({ name, input }, index) => ({ name, input, output: reports[index] }))
		);
	});
});

test('responseCheckExitCode maps the report status and mode to exit codes 0, 1 and 2', () => {
	const expected: Array<[ResponseCheckStatus, ResponseCheckReport['mode'], number]> = [
		['satisfied', 'advisory', 0], ['violations', 'gate', 1], ['needs-review', 'gate', 1],
		['violations', 'advisory', 0], ['incomplete', 'advisory', 2], ['dry-run', 'gate', 0]
	];
	const cases = expected.map(([status, mode]) => ({ name: `${status} status in ${mode} mode`, input: { status, mode }, output: responseCheckExitCode(reportOf({ status, mode })) }));
	recordExampleCases(
		{ unitId: unit, symbol: 'responseCheckExitCode', state: 'responsecheckexitcode-maps-the-report-status-and-mode-to-exi', evidence: 'examples-cases', file: 'responsecheckexitcode-maps-the-report-status-and-mode-to-exi.json' },
		cases
	);
	expect(cases.map(({ output }) => output)).toEqual(expected.map((item) => item[2]));
});

test('renderResponseCheck renders the summary with the fixed assessment disclaimer', () => {
	const cases = [violations, incomplete].map((report) => ({ name: `${report.status} ${report.mode} report`, input: report, output: renderResponseCheck(report) }));
	recordExampleCases(
		{ unitId: unit, symbol: 'renderResponseCheck', state: 'renderresponsecheck-renders-the-summary-with-the-fixed-asses', evidence: 'examples-cases', file: 'renderresponsecheck-renders-the-summary-with-the-fixed-asses.json' },
		cases
	);
	expect(cases.map(({ output }) => output)).toEqual([violationsText, incompleteText]);
});

test('runResponseCheck prints the report and sets the process exit code', async () => {
	await withTempDir('response-check-run-', async (directory) => {
		writeFiles(directory, { request: requestText, empty: '' });
		mkdirSync(join(directory, 'runs', 'release-2026-11'), { recursive: true });
		writeFileSync(join(directory, 'runs', 'release-2026-11', 'manifest.json'), '{}');
		const pair = { request: 'request', response: 'empty' };
		const inputs = [
			{ ...pair, dryRun: true, json: true },
			{ ...pair, gate: true },
			pair,
			{ ...pair, report: 'release-2026-11', dryRun: true, json: true }
		];
		const runs = await withEnv({ HARNESS_ANALYTICS_DISABLED: '1', PROJECT_REPORTS_HOME: directory }, () => runInOrder(directory, inputs));
		expect(runs.map(({ exitCode }) => exitCode)).toEqual([0, 1, 0, 0]);
		expect(runs.map(({ error }) => error)).toEqual([undefined, undefined, undefined, undefined]);
		expect((JSON.parse(runs[0].printed) as ResponseCheckReport).status).toBe('dry-run');
		expect(runs[1].printed.split('\n')[0]).toBe('Response check: violations (gate)');
		recordExampleCases(
			{ unitId: unit, symbol: 'runResponseCheck', state: 'runresponsecheck-prints-the-report-and-sets-the-process-exit', evidence: 'examples-cases', file: 'runresponsecheck-prints-the-report-and-sets-the-process-exit.json' },
			[
				{ name: 'json dry run with an empty response', input: inputs[0], output: runs[0] },
				{ name: 'gate run with an empty response', input: inputs[1], output: runs[1] },
				{ name: 'advisory run with an empty response', input: inputs[2], output: runs[2] },
				{ name: 'report named in the reports home', input: inputs[3], output: runs[3] }
			]
		);
	});
});

test('runResponseCheck rejects invalid report context before any check runs', async () => {
	await withTempDir('response-check-reject-', async (directory) => {
		writeFiles(directory, { request: requestText, response: responseText });
		const pair = { request: 'request', response: 'response' };
		const inputs = [
			{ ...pair, report: 'release notes!' },
			{ ...pair, report: 'missing-report' },
			{ ...pair, task: 'task-17', loop: 'review-loop' },
			{ ...pair, step: 'verify-answer' }
		];
		const outcomes = await withEnv({ PROJECT_REPORTS_HOME: directory }, () => runInOrder(directory, inputs));
		expect(outcomes.map(({ error }) => error?.message)).toEqual([
			'Invalid report ID.',
			"ENOENT: no such file or directory, open '<reports-home>/runs/missing-report/manifest.json'",
			'Use either --task or --loop/--step.',
			'--step requires --loop.'
		]);
		expect(outcomes.every(({ printed, exitCode }) => printed === '' && exitCode === undefined)).toBe(true);
		recordExampleCases(
			{ unitId: unit, symbol: 'runResponseCheck', state: 'runresponsecheck-rejects-invalid-report-context-before-any-c', evidence: 'examples-cases', file: 'runresponsecheck-rejects-invalid-report-context-before-any-c.json' },
			[
				{ name: 'report ID with a space', input: inputs[0], error: outcomes[0].error },
				{ name: 'report ID with no manifest', input: inputs[1], error: outcomes[1].error },
				{ name: 'task together with a loop', input: inputs[2], error: outcomes[2].error },
				{ name: 'step without a loop', input: inputs[3], error: outcomes[3].error }
			]
		);
	});
});
