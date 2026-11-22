import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { z } from 'zod';
import runRecordSchema from '../specification/loops/module-job-model-analytics/run-record-v1.schema.json';
import { expect } from './verificationExpect';
import { runHarness } from './support/cli';
import { verifiedSubmission, verifiedTaskBaseline } from './support/moduleTaskEvidence';
import { moduleTaskFixture } from './support/moduleTaskFixture';
test('failed commands and incomplete checks are recorded without supplied text', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-attribution-'));
	const old = process.env.HARNESS_ANALYTICS_HOME;
	process.env.HARNESS_ANALYTICS_HOME = join(root, 'analytics');
	try {
		await writeFile(join(root, 'request'), 'Private synthetic request marker');
		await writeFile(join(root, 'response'), 'Private synthetic answer marker');
		await runHarness(['unknown-command'], root, false);
		await runHarness(
			[
				'response-check',
				'--request',
				'request',
				'--response',
				'response',
				'--task',
				'answer',
				'--api-key-env',
				'MISSING_TEST_KEY'
			],
			root,
			false
		);
		const data = JSON.parse((await runHarness(['analytics', 'events', '--json'], root)).stdout);
		expect(data.events.find((event: { kind: string }) => event.kind === 'jev')).toMatchObject({
			task: 'answer',
			status: 'incomplete'
		});
		expect(
			data.events.find((event: { action: string }) => event.action === 'help-or-unknown').exitCode
		).toBe(1);
		expect(JSON.stringify(data)).not.toContain('Private synthetic');
		expect(data.jev.response.firstTry.denominator).toBe(0);
	} finally {
		if (old === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = old;
		await rm(root, { recursive: true, force: true });
	}
});
test('analytics write failures do not change the dry-run result', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-record-failure-'));
	const old = process.env.HARNESS_ANALYTICS_HOME;
	try {
		await writeFile(join(root, 'occupied'), 'not a directory');
		process.env.HARNESS_ANALYTICS_HOME = join(root, 'occupied');
		await writeFile(join(root, 'request'), 'Request');
		await writeFile(join(root, 'response'), 'Answer');
		const result = await runHarness(
			['response-check', '--request', 'request', '--response', 'response', '--dry-run', '--json'],
			root
		);
		expect(JSON.parse(result.stdout).status).toBe('dry-run');
		expect(result.stderr).toContain('could not be recorded');
	} finally {
		if (old === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = old;
		await rm(root, { recursive: true, force: true });
	}
});
test('module task CLI reviews preserve one bounce and reconcile token costs idempotently', async () => {
	const f = await moduleTaskFixture(),
		previous = process.env.HARNESS_ANALYTICS_HOME;
	process.env.HARNESS_ANALYTICS_HOME = join(f.root, '.cache', 'analytics');
	try {
		await reviewedTask(f);
		const query = ['analytics', 'tasks', '--project', f.root, '--json'];
		const first = JSON.parse((await runHarness(query, f.root)).stdout);
		const again = JSON.parse((await runHarness(query, f.root)).stdout);
		expect(first).toEqual(again);
		expect(first.tasks).toMatchObject({
			executions: 2,
			submissions: 2,
			accepted: 1,
			bounces: 1,
			reviewed: 2,
			bounceRate: 0.5,
			runRecords: expectedReviewedRuns,
			byModel: [
				{
					model: 'claude-haiku-5-5',
					modelSource: 'reported',
					intelligence: 'medium',
					inputTokens: 200,
					outputTokens: 40,
					cacheReadTokens: 60,
					apiCostUsd: 0.004
				}
			]
		});
		const events = JSON.parse(
			(await runHarness(['analytics', 'events', '--project', f.root, '--json'], f.root)).stdout
		);
		expect(events.events.filter((e: { kind: string }) => e.kind === 'task')).toHaveLength(6);
		expect(JSON.stringify(events.events)).not.toContain('Private repair note marker');
		expect(JSON.stringify(first.tasks.runRecords)).not.toContain('Private repair note marker');
		const schema = z.fromJSONSchema(runRecordSchema as Parameters<typeof z.fromJSONSchema>[0]);
		expect(schema.array().safeParse(first.tasks.runRecords).success).toBe(true);
		const until = first.tasks.runRecords[0].finishedAt;
		const filtered = JSON.parse((await runHarness([...query, '--until', until], f.root)).stdout);
		expect(filtered.tasks.runRecords).toMatchObject([expectedReviewedRuns[0]]);
	} finally {
		if (previous === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previous;
		await f.dispose();
	}
}, 60000);

const expectedReviewedRuns = [
	{
		schemaVersion: 1,
		source: 'harness',
		taskId: 'orders-validation',
		taskType: 'implementation',
		moduleId: 'service.orders',
		model: 'claude-haiku-5-5',
		effort: 'medium',
		estimatedDifficulty: 'medium',
		measuredDifficulty: 'small',
		filesTouched: 1,
		linesChanged: 2,
		attempt: 1,
		retries: 0,
		outcome: 'rejected',
		firstTry: false,
		rejectionCause: 'verification',
		inputTokens: 100,
		outputTokens: 20,
		wallTimeMs: expect.any(Number),
		apiEquivalentUsd: 0.002,
		actualUsd: null,
		codexCredits: null
	},
	{
		attempt: 2,
		retries: 1,
		outcome: 'done',
		firstTry: false,
		rejectionCause: null,
		rejectedBefore: true,
		reworked: true
	}
];

async function reviewedTask(f: Awaited<ReturnType<typeof moduleTaskFixture>>) {
	await verifiedTaskBaseline(f);
	await f.feature();
	await f.cli([
		'add',
		'--input',
		await f.input({
			model: 'claude-haiku-5-5',
			intelligence: 'medium',
			taskType: 'implementation',
			estimatedDifficulty: 'medium'
		})
	]);
	await f.cli(['worker', '--worker', 'owner', '--once']);
	let task = JSON.parse((await f.cli(['show', 'orders-validation'])).stdout).task;
	const reject = [
		'review',
		task.id,
		'--attempt',
		task.claim.token,
		'--verdict',
		'incomplete',
		'--cause',
		'verification',
		'--feedback',
		'Private repair note marker'
	];
	await f.cli(reject);
	expect(JSON.parse((await f.cli(reject)).stdout).replayed).toBe(true);
	await f.cli(['worker', '--worker', 'owner', '--once']);
	task = JSON.parse((await f.cli(['show', 'orders-validation'])).stdout).task;
	const accept = ['review', task.id, '--attempt', task.claim.token, '--verdict', 'accepted'];
	await f.cli(accept, false);
	const evidence = await verifiedSubmission(f, task);
	await f.cli([...accept, '--evidence', evidence.commit]);
}
