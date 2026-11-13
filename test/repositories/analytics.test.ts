import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand } from '../support/cli';
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
		const lockedRoot = join(root, 'async-open');
		const openedUnderLock = await runCommand(
			[
				'bun',
				'-e',
				`import { Database } from 'bun:sqlite'; import { mkdirSync } from 'node:fs'; import { join } from 'node:path'; import { AnalyticsRepository } from ${JSON.stringify(module)}; const root=${JSON.stringify(lockedRoot)}; mkdirSync(root,{recursive:true}); const holder=new Database(join(root,'analytics.sqlite'),{create:true}); holder.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); let timerProgressed=false; let repository; const release=setTimeout(()=>{timerProgressed=true; holder.exec('ROLLBACK;');},100); try { repository=await AnalyticsRepository.open(root); console.log(JSON.stringify({timerProgressed,events:repository.events()})); } finally { clearTimeout(release); if(holder.inTransaction) holder.exec('ROLLBACK;'); holder.close(); repository?.close(); }`
			],
			root,
			false
		);
		expect(openedUnderLock.exitCode, openedUnderLock.stderr).toBe(0);
		expect(JSON.parse(openedUnderLock.stdout)).toEqual({ timerProgressed: true, events: [] });
		await expectWritesWaitForAnalyticsLock(module, root, lockedRoot);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function expectWritesWaitForAnalyticsLock(
	module: string,
	root: string,
	lockedRoot: string
): Promise<void> {
	const writeDuringLock = await runCommand(
		[
			'bun',
			'-e',
			`import { Database } from 'bun:sqlite'; import { AnalyticsRepository } from ${JSON.stringify(module)}; const root=${JSON.stringify(lockedRoot)}; const repository=await AnalyticsRepository.open(root); const writer=Bun.spawn(['bun','-e',"import { Database } from 'bun:sqlite'; const db=new Database(process.argv[1]); db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); setTimeout(()=>{db.exec('ROLLBACK;'); db.close();},150); console.log('locked');", root+'/analytics.sqlite'],{stdout:'pipe',stderr:'pipe'}); const stderr=new Response(writer.stderr).text(); try { const ready=await writer.stdout.getReader().read(); if(ready.done || !new TextDecoder().decode(ready.value).includes('locked')) throw new Error('writer did not acquire its lock'); repository.record({id:'after-async-open',timestamp:'2026-11-13T00:00:00.000Z',project:'/synthetic',kind:'command',action:'audit'}); const exitCode=await writer.exited; if(exitCode!==0) throw new Error(await stderr); console.log(JSON.stringify({exitCode,events:repository.events()})); } finally { await writer.exited; repository.close(); }`
		],
		root,
		false
	);
	expect(writeDuringLock.exitCode, writeDuringLock.stderr).toBe(0);
	expect(JSON.parse(writeDuringLock.stdout)).toMatchObject({
		exitCode: 0,
		events: [{ id: 'after-async-open', project: '/synthetic', action: 'audit' }]
	});
}
