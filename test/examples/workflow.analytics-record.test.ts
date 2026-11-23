import { test, vi } from 'vitest';
import { basename } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	projectIdentity,
	resolvedContext,
	recordAnalytics,
	fingerprint,
	validateReport
} from '../../src/workflows/reports-media/analyticsRecord';
import { withTempDir } from '../support/temporary';

async function captureError(run: () => unknown | Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (error) {
		return error as Error;
	}
	throw new Error('Expected operation to throw.');
}

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
			[
				{
					name: 'directory without a worktree resolves to itself',
					input: { root: directory },
					output
				}
			]
		);
	});
});

test('Throws invalid analytics context when task conflicts with loop', async () => {
	const input = { task: 'triage-analytics', loop: 'daily' };
	const error = await captureError(() => resolvedContext(input, '/workspace/project'));
	expect(error.message).toBe('Use either --task or --loop/--step.');
	recordExampleCases(
		{
			unitId: 'workflow.analytics-record',
			symbol: 'resolvedContext',
			state: 'throws-invalid-analytics-context-when-task-conflicts-with-lo',
			evidence: 'examples-cases',
			file: 'throws-invalid-analytics-context-when-task-conflicts-with-lo.json'
		},
		[
			{
				name: 'task and loop cannot be selected together',
				input,
				error: { name: error.name, message: error.message }
			}
		]
	);
});

test('Throws loop state access failure when selected state is missing', async () => {
	const input = { loop: 'missing-loop' };
	vi.stubEnv('HARNESS_ANALYTICS_LOOP', '');
	try {
		const error = await captureError(() => resolvedContext(input, '/workspace/project'));
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'workflow.analytics-record',
				symbol: 'resolvedContext',
				state: 'throws-loop-state-access-failure-when-selected-state-is-miss',
				evidence: 'examples-cases',
				file: 'throws-loop-state-access-failure-when-selected-state-is-miss.json'
			},
			[
				{
					name: 'missing loop state read propagates',
					input,
					error: { name: error.name, message: error.message }
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
	}
});

test('Throws invalid report reference when ID contains punctuation', async () => {
	const input = { report: 'bad/report' };
	vi.stubEnv('HARNESS_ANALYTICS_REPORT', '');
	try {
		const error = await captureError(() => validateReport(input));
		expect(error.message).toBe('Invalid report ID.');
		recordExampleCases(
			{
				unitId: 'workflow.analytics-record',
				symbol: 'validateReport',
				state: 'throws-invalid-report-reference-when-id-contains-punctuation',
				evidence: 'examples-cases',
				file: 'throws-invalid-report-reference-when-id-contains-punctuation.json'
			},
			[
				{
					name: 'punctuation is rejected before manifest access',
					input,
					error: { name: error.name, message: error.message }
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
	}
});

test('Throws JSON serialization failure for undefined', () => {
	const input = { serializedValue: 'undefined' };
	let error: Error | undefined;
	try {
		fingerprint(undefined as never);
	} catch (caught) {
		error = caught as Error;
	}
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'workflow.analytics-record',
			symbol: 'fingerprint',
			state: 'throws-json-serialization-failure-for-undefined',
			evidence: 'examples-cases',
			file: 'throws-json-serialization-failure-for-undefined.json'
		},
		[
			{
				name: 'undefined cannot be serialized to a fingerprint',
				input,
				error: { name: error?.name, message: error?.message }
			}
		]
	);
});
