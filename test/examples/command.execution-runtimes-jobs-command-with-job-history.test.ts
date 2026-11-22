import { test } from 'vitest';
import { withJobHistory } from '../../src/commands/execution-runtimes/jobs-command/withJobHistory';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const job = {
	id: 'example-job',
	source: 'fixture-run',
	attempt: 1,
	unit: 'unit.example',
	type: 'test',
	model: 'fixture-model',
	startedAt: 1200
};

test('Closes the selected job history after a successful action', async () => {
	await withTempDir('job-history-success-', (home) => {
		let history: { all: () => unknown[] } | undefined;
		let actionResult: unknown;
		const returned = withJobHistory({ home }, (opened) => {
			history = opened;
			const started = opened.start(job);
			actionResult = { started, jobs: opened.all() };
		});

		expect(returned).toBeUndefined();
		expect(actionResult).toEqual({ started: job, jobs: [job] });
		expect(() => history?.all()).toThrow();
		recordExampleCases(
			{
				unitId: 'command.execution-runtimes-jobs-command-with-job-history',
				symbol: 'withJobHistory',
				state: 'closes-the-selected-job-history-after-a-successful-action',
				evidence: 'examples-cases',
				file: 'closes-the-selected-job-history-after-a-successful-action.json'
			},
			[
				{
					name: 'selected temporary store records a job and closes after success',
					input: { options: { home: 'temporary' }, action: { start: job } },
					output: { returnValue: null, actionResult, historyClosed: true }
				}
			]
		);
	});
});

test('Closes the selected job history when the action throws', async () => {
	await withTempDir('job-history-failure-', (home) => {
		const actionFailure = new Error('example action failed');
		let history: { all: () => unknown[] } | undefined;
		let caught: unknown;
		try {
			withJobHistory({ home }, (opened) => {
				history = opened;
				opened.start(job);
				throw actionFailure;
			});
		} catch (error) {
			caught = error;
		}
		const errorResult =
			caught instanceof Error
				? { name: caught.name, message: caught.message }
				: { name: 'MissingError', message: 'action did not throw' };

		expect(caught).toBe(actionFailure);
		expect(() => history?.all()).toThrow();
		recordExampleCases(
			{
				unitId: 'command.execution-runtimes-jobs-command-with-job-history',
				symbol: 'withJobHistory',
				state: 'closes-the-selected-job-history-when-the-action-throws',
				evidence: 'examples-cases',
				file: 'closes-the-selected-job-history-when-the-action-throws.json'
			},
			[
				{
					name: 'selected temporary store closes after its action fails',
					input: {
						options: { home: 'temporary' },
						action: { start: job, thenThrow: 'example action failed' }
					},
					error: errorResult
				}
			]
		);
	});
});
