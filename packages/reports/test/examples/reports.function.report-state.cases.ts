import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportState } from '../../src/repositories/reports-media/report-repository/reportState';
import type { BeginInput, Report } from './reports.function.report-state.test.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const BASE_INPUT: BeginInput = {
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
