import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JobsOptions } from '../../src/commands/execution-runtimes/JobsCommand.types';
import { jobsQueue } from '../../src/commands/execution-runtimes/jobs-command/jobsQueue';
import type { QueueSnapshot } from '../../src/services/execution-runtimes/QueueEtaService.types';
import { test } from 'vitest';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function captureError(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error('Expected jobsQueue to throw');
}

function errorDetails(error: Error): { name: string; message: string } {
	return { name: error.name, message: error.message };
}

test('Replaces an explicit queue and merges capacity overrides', async () => {
	await withTempDir('jobs-queue-explicit-', (directory) => {
		const queuePath = join(directory, 'queue.json');
		const explicitQueue: QueueSnapshot = {
			queued: [{ id: 'task-17', type: 'build', model: 'luna' }],
			running: [{ id: 'task-18', type: 'test', model: 'haiku', startedAt: 1763298000000 }],
			slots: { luna: 1, haiku: 2 },
			warnings: ['fixture queue']
		};
		writeFileSync(queuePath, JSON.stringify(explicitQueue));
		const live: QueueSnapshot = {
			queued: [{ id: 'live-queued', type: 'review', model: 'luna' }],
			running: [],
			slots: { luna: 9, opus: 1 },
			warnings: ['live snapshot']
		};
		const options: JobsOptions = { queue: queuePath, slots: 'luna=3,claude=2' };
		const output = jobsQueue(options, live);

		expect(output).toEqual({
			queued: explicitQueue.queued,
			running: explicitQueue.running,
			slots: { luna: 3, haiku: 2, claude: 2 },
			warnings: explicitQueue.warnings
		});
		recordExampleCases(
			{
				unitId: 'command.execution-runtimes-jobs-command-jobs-queue',
				symbol: 'jobsQueue',
				state: 'replaces-an-explicit-queue-and-merges-capacity-overrides',
				evidence: 'examples-cases',
				file: 'replaces-an-explicit-queue-and-merges-capacity-overrides.json'
			},
			[
				{
					name: 'replaces live jobs and overlays requested model capacity',
					input: { options, live },
					output
				}
			]
		);
	});
});

test('Builds bounded what-if queues without live jobs', () => {
	const live: QueueSnapshot = {
		queued: [{ id: 'queued-live', type: 'build', model: 'luna' }],
		running: [{ id: 'running-live', type: 'test', model: 'haiku', startedAt: 1763298000000 }],
		slots: { luna: 2, haiku: 1 }
	};
	const twoJobsOptions: JobsOptions = { whatIf: '2', type: 'reverify', model: 'luna' };
	const zeroJobsOptions: JobsOptions = { whatIf: '0', type: 'reverify', model: 'luna' };
	const twoJobs = jobsQueue(twoJobsOptions, live);
	const zeroJobs = jobsQueue(zeroJobsOptions, live);

	expect(twoJobs).toEqual({
		queued: [
			{ type: 'reverify', model: 'luna' },
			{ type: 'reverify', model: 'luna' }
		],
		running: [],
		slots: live.slots,
		warnings: [
			'What-if only: 2 jobs; excludes live work. Capacity is observed or explicitly overridden.'
		]
	});
	// A missing flag is the caller's mistake: the CLI prints it without a stack trace.
	expect(() => jobsQueue({ whatIf: '2' }, live)).toThrow(ExpectedCliError);
	expect(zeroJobs.queued).toEqual([]);
	expect(zeroJobs.running).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs-command-jobs-queue',
			symbol: 'jobsQueue',
			state: 'builds-bounded-what-if-queues-without-live-jobs',
			evidence: 'examples-cases',
			file: 'builds-bounded-what-if-queues-without-live-jobs.json'
		},
		[
			{
				name: 'creates requested reverify work and excludes live jobs',
				input: { options: twoJobsOptions, live },
				output: twoJobs
			},
			{
				name: 'zero count creates an empty queue while retaining capacity',
				input: { options: zeroJobsOptions, live },
				output: zeroJobs
			}
		]
	);
});

test('Counts active units for all-modules what-if queues', async () => {
	await withTempDir('jobs-queue-registry-', (project) => {
		const unitsDirectory = join(project, 'specification', 'units');
		mkdirSync(unitsDirectory, { recursive: true });
		writeFileSync(join(unitsDirectory, 'active.json'), JSON.stringify({ status: 'active' }));
		writeFileSync(join(unitsDirectory, 'retired.json'), JSON.stringify({ status: 'retired' }));
		writeFileSync(join(unitsDirectory, 'legacy-retired.json'), JSON.stringify({ retired: true }));
		const options: JobsOptions = {
			whatIf: 'all-modules',
			type: 'reverify',
			model: 'luna',
			project
		};
		const live: QueueSnapshot = {
			queued: [{ id: 'live-queued', type: 'build', model: 'haiku' }],
			running: [{ id: 'live-running', type: 'test', model: 'luna', startedAt: 1763298000000 }],
			slots: { luna: 2 }
		};
		const output = jobsQueue(options, live);

		expect(output.queued).toEqual([{ type: 'reverify', model: 'luna' }]);
		expect(output.running).toEqual([]);
		expect(output.slots).toEqual(live.slots);
		recordExampleCases(
			{
				unitId: 'command.execution-runtimes-jobs-command-jobs-queue',
				symbol: 'jobsQueue',
				state: 'counts-active-units-for-all-modules-what-if-queues',
				evidence: 'examples-cases',
				file: 'counts-active-units-for-all-modules-what-if-queues.json'
			},
			[
				{
					name: 'counts active registry units and excludes retired entries',
					input: { options, live },
					output
				}
			]
		);
	});
});

test('Rejects malformed queue JSON and invalid what-if flags', async () => {
	await withTempDir('jobs-queue-invalid-', (directory) => {
		const malformedPath = join(directory, 'malformed.json');
		writeFileSync(malformedPath, '{"queued":');
		const live: QueueSnapshot = { queued: [], running: [], slots: { luna: 1 } };
		const malformedInput = { options: { queue: malformedPath }, live };
		const countInput = { options: { whatIf: '1000001', type: 'build', model: 'luna' }, live };
		const requiredInput = { options: { whatIf: '1', type: 'build' }, live };
		const malformedError = captureError(() => jobsQueue(malformedInput.options, live));
		const countError = captureError(() => jobsQueue(countInput.options, live));
		const requiredError = captureError(() => jobsQueue(requiredInput.options, live));

		expect(malformedError).toBeInstanceOf(SyntaxError);
		expect(countError).toBeInstanceOf(ExpectedCliError);
		expect(requiredError).toBeInstanceOf(ExpectedCliError);
		recordExampleCases(
			{
				unitId: 'command.execution-runtimes-jobs-command-jobs-queue',
				symbol: 'jobsQueue',
				state: 'rejects-malformed-queue-json-and-invalid-what-if-flags',
				evidence: 'examples-cases',
				file: 'rejects-malformed-queue-json-and-invalid-what-if-flags.json'
			},
			[
				{
					name: 'malformed explicit queue JSON propagates syntax error',
					input: malformedInput,
					error: errorDetails(malformedError)
				},
				{
					name: 'count above the supported maximum is rejected',
					input: countInput,
					error: errorDetails(countError)
				},
				{
					name: 'what-if requires both job type and model',
					input: requiredInput,
					error: errorDetails(requiredError)
				}
			]
		);
	});
});
