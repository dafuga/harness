import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';
test('shared worktree histories count once under the primary project', async () => {
	const root = await mkdtemp(join(tmpdir(), 'analytics-worktrees-'));
	const previous = process.env.HARNESS_ANALYTICS_HOME;
	process.env.HARNESS_ANALYTICS_HOME = join(root, 'analytics');
	try {
		const main = join(root, 'main');
		await mkdir(main);
		await runCommand(['git', 'init'], main);
		await runHarness(['loop', 'create', 'delivery', '--from', 'feature', '--goal', 'Ship'], main);
		await runCommand(['git', 'add', '.'], main);
		await runCommand(
			[
				'git',
				'-c',
				'user.name=Fixture',
				'-c',
				'user.email=fixture@example.test',
				'commit',
				'-m',
				'chore: fixture'
			],
			main
		);
		await runCommand(['git', 'worktree', 'add', join(root, 'copy'), '-b', 'copy'], main);
		await runHarness(['analytics', 'import', '--root', root], root);
		const data = JSON.parse(
			(await runHarness(['analytics', 'loops', '--project', join(root, 'copy'), '--json'], root))
				.stdout
		);
		expect(data.loops).toHaveLength(1);
		expect(data.loops[0].project).toMatch(/\/main$/);
	} finally {
		if (previous === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previous;
		await rm(root, { recursive: true, force: true });
	}
});
