import { test, vi } from 'vitest';
import { basename } from 'node:path';
import {
	expect
} from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	projectIdentity,
	resolvedContext,
	recordAnalytics,
	fingerprint,
	validateReport
} from '../../src/workflows/reports-media/analyticsRecord';
import { withTempDir } from '../support/temporary';

test('Resolves the requested task context', async () => {
	vi.stubEnv('HARNESS_ANALYTICS_TASK', '');
	vi.stubEnv('HARNESS_AGENT_MODEL', '');
	try {
		const output = await resolvedContext(
			{ task: 'triage-analytics', agentModel: 'model-x' },
			'/workspace/project'
		);
		expect(output).toMatchObject({ task: 'triage-analytics', agentModel: 'model-x' });
		recordExampleCases(
			{
				unitId: 'workflow.analytics-record',
				symbol: 'resolvedContext',
				state: 'resolves-the-requested-task-context',
				evidence: 'examples-cases',
				file: 'resolves-the-requested-task-context.json'
			},
			[{ name: 'task context retains its task and model', input: { task: 'triage-analytics', agentModel: 'model-x' }, output }]
		);
	} finally {
		vi.unstubAllEnvs();
	}
});

test('Skips analytics when recording is disabled', async () => {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
	try {
		const input = { kind: 'command' as const, action: 'run' };
		const output = await recordAnalytics(input, '/workspace/project');
		expect(output).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'workflow.analytics-record',
				symbol: 'recordAnalytics',
				state: 'skips-analytics-when-recording-is-disabled',
				evidence: 'examples-cases',
				file: 'skips-analytics-when-recording-is-disabled.json'
			},
			[{ name: 'disabled recording resolves without storing an event', input, output: null }]
		);
	} finally {
		vi.unstubAllEnvs();
	}
});

test('Fingerprints JSON-compatible values', () => {
	const input = { action: 'search', count: 2 };
	const output = fingerprint(input);
	expect(output).toMatch(/^[a-f0-9]{64}$/);
	recordExampleCases(
		{
			unitId: 'workflow.analytics-record',
			symbol: 'fingerprint',
			state: 'fingerprints-json-compatible-values',
			evidence: 'examples-cases',
			file: 'fingerprints-json-compatible-values.json'
		},
		[{ name: 'object values produce a lowercase SHA-256 digest', input, output }]
	);
});

test('Accepts a context without a report', async () => {
	const input = {};
	const output = await validateReport(input);
	expect(output).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'workflow.analytics-record',
			symbol: 'validateReport',
			state: 'accepts-a-context-without-a-report',
			evidence: 'examples-cases',
			file: 'accepts-a-context-without-a-report.json'
		},
		[{ name: 'missing report needs no manifest lookup', input, output: null }]
	);
});

test('Resolves the primary project directory', async () => {
	await withTempDir('analytics-record-project-', async (directory) => {
		const output = await projectIdentity(directory);
		expect(basename(output)).toBe(basename(directory));
		recordExampleCases(
			{
				unitId: 'workflow.analytics-record',
				symbol: 'projectIdentity',
				state: 'resolves-the-primary-project-directory',
				evidence: 'examples-cases',
				file: 'resolves-the-primary-project-directory.json'
			},
			[{ name: 'directory without a worktree resolves to itself', input: { root: directory }, output }]
		);
	});
});
