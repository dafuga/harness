import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TaskCommand } from '../../src/cli/program/TaskCommand';
import { runHarness } from '../support/cli';
import { taskAuditRepo } from '../support/taskAuditRepo';

test('the task command shares the planning and coding completion gates', async () => {
	const repo = await taskAuditRepo();
	try {
		const command = new TaskCommand(repo.root);
		expect(
			(await command.run({ kind: 'planning', goal: 'Plan search', plan: 'plan.md' })).passed
		).toBe(true);
		expect((await command.run({ kind: 'coding', goal: 'Implement search' })).passed).toBe(false);
	} finally {
		await repo.dispose();
	}
});

test('feature completion rejects an unsupported free-text verification claim', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-completion-'));
	try {
		await runHarness(
			[
				'loop',
				'create',
				'delivery',
				'--from',
				'feature',
				'--kind',
				'coding',
				'--goal',
				'Deliver search'
			],
			root
		);
		for (const step of ['spec', 'implement', 'test'])
			await runHarness(['loop', 'complete', 'delivery', step, '--evidence', 'Recorded work'], root);
		const done = await runHarness(
			['loop', 'complete', 'delivery', 'verify', '--evidence', 'Everything passed'],
			root,
			false
		);
		expect(done.exitCode, 'a claim cannot substitute for the completion audit').toBe(1);
		expect(done.stderr).toContain('completion audit');
		const status = await runHarness(['loop', 'status', 'delivery', '--json'], root);
		expect(JSON.parse(status.stdout).state.steps.at(-1).status).toBe('pending');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);
