import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { Database } from 'bun:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand } from '../support/cli';
import { AnalyticsRepository } from '../../src/repositories/reports-media/AnalyticsRepository';
test('durable analytics supports concurrent writers and duplicate identities', async () => {
	const root = await mkdtemp(join(tmpdir(), 'analytics-store-'));
	const module = join(process.cwd(), 'src/repositories/AnalyticsRepository.ts');
	const script = `import { AnalyticsRepository } from ${JSON.stringify(module)}; const r=new AnalyticsRepository(${JSON.stringify(root)}); r.record({id:'shared',timestamp:'2026-10-06',project:'/test',kind:'command',action:'audit'}); r.close();`;
	try {
		const results = await Promise.all(
			Array.from({ length: 6 }, () => runCommand(['bun', '-e', script], root))
		);
		expect(results.every((result) => result.exitCode === 0)).toBe(true);
		const result = await runCommand(
			[
				'bun',
				'-e',
				`import { AnalyticsRepository } from ${JSON.stringify(module)}; const r=new AnalyticsRepository(${JSON.stringify(root)}); console.log(r.events().length); r.close();`
			],
			root
		);
		expect(result.stdout.trim()).toBe('1');
		const pruned = await runCommand(
			[
				'bun',
				'-e',
				`import { AnalyticsRepository } from ${JSON.stringify(module)}; const r=new AnalyticsRepository(${JSON.stringify(root)}); const preview=r.prune('2026-10-07T00:00:00.000Z'); const retained=r.events().length; const applied=r.prune('2026-10-07T00:00:00.000Z',true); console.log(JSON.stringify({preview,retained,applied,remaining:r.events().length})); r.close();`
			],
			root,
			false
		);
		expect(pruned.exitCode).toBe(0);
		expect(JSON.parse(pruned.stdout)).toMatchObject({
			preview: { matching: 1, deleted: 0, dryRun: true },
			retained: 1,
			applied: { matching: 1, deleted: 1, dryRun: false },
			remaining: 0
		});
		const factory = (
			AnalyticsRepository as unknown as {
				open?: (home: string) => Promise<AnalyticsRepository>;
			}
		).open;
		expect(factory).toBeTypeOf('function');
		const lockedRoot = join(root, 'async-open');
		await mkdir(lockedRoot);
		const lockPath = join(lockedRoot, 'analytics.sqlite');
		const holder = new Database(lockPath, { create: true });
		holder.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;');
		let timerProgressed = false;
		let opened: AnalyticsRepository | undefined;
		const release = setTimeout(() => {
			timerProgressed = true;
			holder.exec('ROLLBACK;');
		}, 100);
		try {
			opened = await factory!(lockedRoot);
		} finally {
			clearTimeout(release);
			if (holder.inTransaction) holder.exec('ROLLBACK;');
			holder.close();
		}
		expect(timerProgressed).toBe(true);
		expect(opened!.events()).toEqual([]);
		opened!.close();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
