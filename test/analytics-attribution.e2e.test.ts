import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { runHarness } from './support/cli';
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
	} finally {
		if (previous === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previous;
		await f.dispose();
	}
}, 60000);

async function reviewedTask(f: Awaited<ReturnType<typeof moduleTaskFixture>>) {
	await f.feature();
	await f.cli([
		'add',
		'--input',
		await f.input({ model: 'claude-haiku-5-5', intelligence: 'medium' })
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
		'--feedback',
		'Private repair note marker'
	];
	await f.cli(reject);
	await f.cli(reject, false);
	await f.cli(['worker', '--worker', 'owner', '--once']);
	task = JSON.parse((await f.cli(['show', 'orders-validation'])).stdout).task;
	await f.cli(['review', task.id, '--attempt', task.claim.token, '--verdict', 'accepted']);
}
