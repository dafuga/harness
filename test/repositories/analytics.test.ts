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
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
