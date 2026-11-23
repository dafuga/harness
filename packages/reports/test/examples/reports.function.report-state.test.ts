import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportState } from '../../src/repositories/reports-media/report-repository/reportState';
import { InvalidReportStateInputError } from '../../src/repositories/reports-media/report-repository/reportState.types';
import { resultStatus, interrupted } from '../../src/utils/reports-media/reportState';

type BeginInput = Parameters<typeof reportState>[0];
type Report = ReturnType<typeof reportState>;
type Status = Report['status'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BASE_INPUT: BeginInput = {
	project: '/workspace/project',
	title: 'Build report-state coverage',
	mode: 'feature',
	environment: 'local',
	revision: '0123456789abcdef0123456789abcdef01234567',
	historical: false,
	summary: 'Initialized for feature review.',
	acceptance: []
};

const FALLBACK_INPUT: BeginInput = {
	project: '/workspace/other',
	title: 'Suite run',
	mode: 'suite',
	environment: '',
	historical: true
};

const INVALID_INPUTS: Array<{ name: string; input: unknown }> = [
	{ name: 'project is empty', input: { project: '', title: 'Missing project', mode: 'feature' } },
	{ name: 'title is empty', input: { project: '/workspace/project', title: '', mode: 'feature' } },
	{
		name: 'mode is unknown',
		input: { project: '/workspace/project', title: 'Bad mode', mode: 'review' }
	}
];

function summarize(report: Report) {
	return {
		title: report.title,
		mode: report.mode,
		environment: report.environment,
		historical: report.historical,
		status: report.status,
		state: report.state,
		revision: report.revision ?? null,
		projectName: report.project.name,
		summary: report.summary,
		acceptance: report.acceptance
	};
}

function failureOf(input: unknown): Error {
	try {
		reportState(input as BeginInput);
	} catch (error) {
		return error as Error;
	}
	return new Error('no error thrown');
}

function statusItems(statuses: Status[] = []) {
	return statuses.map((status) => ({ status }));
}

function reportWith(
	parts: Partial<Record<'checks' | 'findings' | 'coverage' | 'evidence', Status[]>>
): Report {
	return {
		...reportState(BASE_INPUT),
		checks: statusItems(parts.checks) as Report['checks'],
		findings: statusItems(parts.findings) as Report['findings'],
		coverage: statusItems(parts.coverage) as Report['coverage'],
		evidence: statusItems(parts.evidence) as Report['evidence']
	};
}

function reportUpdatedAt(updatedAt: string, state: Report['state'] = 'active'): Report {
	return { ...reportState(BASE_INPUT), updatedAt, state };
}

function minutesAgo(minutes: number): string {
	return new Date(Date.now() - minutes * 60_000).toISOString();
}

test('Starts an active report from begin input', () => {
	const started = reportState(BASE_INPUT);
	const defaulted = reportState(FALLBACK_INPUT);
	expect(started).toMatchObject({
		schemaVersion: 1,
		title: 'Build report-state coverage',
		mode: 'feature',
		historical: false,
		status: 'running',
		state: 'active',
		checks: [],
		evidence: [],
		findings: [],
		coverage: [],
		project: { name: 'project', path: '/workspace/project' }
	});
	expect(started.id).toMatch(UUID);
	expect(started.startedAt).toBe(started.updatedAt);
	expect(defaulted).toMatchObject({
		environment: 'local',
		summary: '',
		acceptance: [],
		historical: true,
		mode: 'suite'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-state',
			symbol: 'reportState',
			state: 'starts-an-active-report-from-begin-input',
			evidence: 'examples-cases',
			file: 'starts-an-active-report-from-begin-input.json'
		},
		[
			{
				name: 'feature report with recorded revision',
				input: BASE_INPUT,
				output: summarize(started)
			},
			{
				name: 'suite report falls back to defaults',
				input: FALLBACK_INPUT,
				output: summarize(defaulted)
			}
		]
	);
});

test('Rejects begin input without project, title or valid mode', () => {
	const cases = INVALID_INPUTS.map(({ name, input }) => {
		const error = failureOf(input);
		expect(error).toBeInstanceOf(InvalidReportStateInputError);
		expect(error.message).toBe('Project, title and valid mode are required');
		return { name, input, error: { name: error.name, message: error.message } };
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-state',
			symbol: 'reportState',
			state: 'rejects-begin-input-without-project-title-or-valid-mode',
			evidence: 'examples-cases',
			file: 'rejects-begin-input-without-project-title-or-valid-mode.json'
		},
		cases
	);
});

test('Derives the result status from recorded items', () => {
	const cases: Array<{ name: string; report: Report; status: Status }> = [
		{ name: 'no checks recorded', report: reportWith({}), status: 'not-proven' },
		{
			name: 'every check skipped',
			report: reportWith({ checks: ['skipped', 'skipped'] }),
			status: 'skipped'
		},
		{
			name: 'checks passed',
			report: reportWith({ checks: ['passed', 'skipped'] }),
			status: 'passed'
		},
		{
			name: 'running evidence blocks',
			report: reportWith({ checks: ['passed'], evidence: ['running'] }),
			status: 'blocked'
		},
		{
			name: 'failed finding beats blocked check',
			report: reportWith({ checks: ['blocked'], findings: ['failed'] }),
			status: 'failed'
		}
	];
	const results = cases.map((item) => {
		expect(resultStatus(item.report)).toBe(item.status);
		return {
			name: item.name,
			input: { checks: item.report.checks.length },
			output: resultStatus(item.report)
		};
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-state',
			symbol: 'resultStatus',
			state: 'derives-the-result-status-from-recorded-items',
			evidence: 'examples-cases',
			file: 'derives-the-result-status-from-recorded-items.json'
		},
		results
	);
});

test('Flags a stale unfinalized report as interrupted', () => {
	const cases = [
		{
			name: 'active report idle 20 minutes',
			input: { updatedAt: minutesAgo(20), state: 'active' },
			output: true
		},
		{
			name: 'active report updated 1 minute ago',
			input: { updatedAt: minutesAgo(1), state: 'active' },
			output: false
		},
		{
			name: 'finalized report idle 20 minutes',
			input: { updatedAt: minutesAgo(20), state: 'finalized' },
			output: false
		},
		{
			name: 'unparseable updatedAt',
			input: { updatedAt: 'not-a-time', state: 'active' },
			output: false
		}
	];
	const results = cases.map(({ name, input, output }) => {
		const actual = interrupted(reportUpdatedAt(input.updatedAt, input.state as Report['state']));
		expect(actual).toBe(output);
		return { name, input, output: actual };
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-state',
			symbol: 'interrupted',
			state: 'flags-a-stale-unfinalized-report-as-interrupted',
			evidence: 'examples-cases',
			file: 'flags-a-stale-unfinalized-report-as-interrupted.json'
		},
		results
	);
});
