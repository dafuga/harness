import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';
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
