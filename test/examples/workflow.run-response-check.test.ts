import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	checkResponse,
	renderResponseCheck,
	responseCheckExitCode
} from '../../src/cli/program/runResponseCheck';
import type {
	ResponseCheckReport,
	ResponseCheckStatus
} from '../../src/core/verification-evidence/responseCheckTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import {
	writeFiles,
	requestText,
	responseText,
	criteriaText,
	withEnv,
	credential,
	sha256,
	standardIds,
	unit,
	reportOf,
	violations,
	incomplete,
	violationsText,
	incompleteText,
	runInOrder
} from './workflow.run-response-check.fixtures';
import { caseRows } from './workflow.run-response-check.rows';

test('checkResponse returns dry-run, assessed and incomplete reports without a model call', async () => {
	await withTempDir('response-check-reports-', async (directory) => {
		writeFiles(directory, {
			request: requestText,
			response: responseText,
			context: 'Earlier notes for the support team.',
			criteria: criteriaText,
			empty: '',
			blank: '  \n',
			'bad-criteria': '{not json',
			'object-criteria': '{"id":"cite-sources","description":"Cite a source."}',
			long: 'a'.repeat(12000)
		});
		const rows = caseRows(directory);
		const reports = await withEnv({ [credential]: '' }, () =>
			Promise.all(rows.map(({ options }) => checkResponse(options)))
		);
		expect(reports[0].inputHashes).toEqual({
			request: sha256(requestText),
			response: sha256(responseText),
			context: sha256(''),
			criteria: sha256('[]')
		});
		expect(reports[1].coverage).toEqual([...standardIds, 'custom:cite-sources']);
		expect(reports[2].checks.map(({ status }) => status)).toEqual([
			'violates',
			'needs-review',
			'needs-review',
			'needs-review',
			'needs-review'
		]);
		expect(reports.map(({ status, error }) => [status, error])).toEqual(
			rows.map(({ status, error }) => [status, error])
		);
		recordExampleCases(
			{
				unitId: unit,
				symbol: 'checkResponse',
				state: 'checkresponse-returns-dry-run-assessed-and-incomplete-report',
				evidence: 'examples-cases',
				file: 'checkresponse-returns-dry-run-assessed-and-incomplete-report.json'
			},
			rows.map(({ name, input }, index) => ({ name, input, output: reports[index] }))
		);
	});
});

test('responseCheckExitCode maps the report status and mode to exit codes 0, 1 and 2', () => {
	const expected: Array<[ResponseCheckStatus, ResponseCheckReport['mode'], number]> = [
		['satisfied', 'advisory', 0],
		['violations', 'gate', 1],
		['needs-review', 'gate', 1],
		['violations', 'advisory', 0],
		['incomplete', 'advisory', 2],
		['dry-run', 'gate', 0]
	];
	const cases = expected.map(([status, mode]) => ({
		name: `${status} status in ${mode} mode`,
		input: { status, mode },
		output: responseCheckExitCode(reportOf({ status, mode }))
	}));
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'responseCheckExitCode',
			state: 'responsecheckexitcode-maps-the-report-status-and-mode-to-exi',
			evidence: 'examples-cases',
			file: 'responsecheckexitcode-maps-the-report-status-and-mode-to-exi.json'
		},
		cases
	);
	expect(cases.map(({ output }) => output)).toEqual(expected.map((item) => item[2]));
});

test('renderResponseCheck renders the summary with the fixed assessment disclaimer', () => {
	const cases = [violations, incomplete].map((report) => ({
		name: `${report.status} ${report.mode} report`,
		input: report,
		output: renderResponseCheck(report)
	}));
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'renderResponseCheck',
			state: 'renderresponsecheck-renders-the-summary-with-the-fixed-asses',
			evidence: 'examples-cases',
			file: 'renderresponsecheck-renders-the-summary-with-the-fixed-asses.json'
		},
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
		const runs = await withEnv(
			{ HARNESS_ANALYTICS_DISABLED: '1', PROJECT_REPORTS_HOME: directory },
			() => runInOrder(directory, inputs)
		);
		expect(runs.map(({ exitCode }) => exitCode)).toEqual([0, 1, 0, 0]);
		expect(runs.map(({ error }) => error)).toEqual([undefined, undefined, undefined, undefined]);
		expect((JSON.parse(runs[0].printed) as ResponseCheckReport).status).toBe('dry-run');
		expect(runs[1].printed.split('\n')[0]).toBe('Response check: violations (gate)');
		recordExampleCases(
			{
				unitId: unit,
				symbol: 'runResponseCheck',
				state: 'runresponsecheck-prints-the-report-and-sets-the-process-exit',
				evidence: 'examples-cases',
				file: 'runresponsecheck-prints-the-report-and-sets-the-process-exit.json'
			},
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
		const outcomes = await withEnv({ PROJECT_REPORTS_HOME: directory }, () =>
			runInOrder(directory, inputs)
		);
		expect(outcomes.map(({ error }) => error?.message)).toEqual([
			'Invalid report ID.',
			"ENOENT: no such file or directory, open '<reports-home>/runs/missing-report/manifest.json'",
			'Use either --task or --loop/--step.',
			'--step requires --loop.'
		]);
		expect(
			outcomes.every(({ printed, exitCode }) => printed === '' && exitCode === undefined)
		).toBe(true);
		recordExampleCases(
			{
				unitId: unit,
				symbol: 'runResponseCheck',
				state: 'runresponsecheck-rejects-invalid-report-context-before-any-c',
				evidence: 'examples-cases',
				file: 'runresponsecheck-rejects-invalid-report-context-before-any-c.json'
			},
			[
				{ name: 'report ID with a space', input: inputs[0], error: outcomes[0].error },
				{ name: 'report ID with no manifest', input: inputs[1], error: outcomes[1].error },
				{ name: 'task together with a loop', input: inputs[2], error: outcomes[2].error },
				{ name: 'step without a loop', input: inputs[3], error: outcomes[3].error }
			]
		);
	});
});
