import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { moduleTaskFixture } from './support/moduleTaskFixture';
import { completionReceipt } from './completion-hooks.cases';

test('a passing declared check preserves the original when reduction measurement is unavailable', async () => {
	const f = await moduleTaskFixture({ checks: [] });
	try {
		await f.feature();
		await writeFile(join(f.root, 'mode'), 'completion-measurement-unavailable');
		const check = { argv: ['bun', 'test', 'src/orders.test.ts'] };
		await f.cli([
			'add',
			'--input',
			await f.input({ model: 'claude-haiku-5-5', verificationFiles: ['src/orders.test.ts'], check })
		]);
		const run = await f.cli(
			['worker', '--worker=owner', '--once', '--allow-task-checks', '--json'],
			false
		);
		expect(run.exitCode).toBe(0);
		const { status, result } = JSON.parse(run.stdout);
		expect(status).toBe('review');
		expect(result.checkRounds).toMatchObject([{ status: 'passed', exitCode: 0 }]);
		const receipt = await completionReceipt(result.text);
		expect(receipt.checks[0]).toMatchObject({
			name: 'reduce-module-bytes',
			disposition: 'discarded',
			reason: 'Module verification tests failed.',
			before: { testExitCode: 1 }
		});
		expect(receipt.checks[0].after).toBeUndefined();
		expect(await readFile(join(result.worktree, 'src/orders.ts'), 'utf8')).toContain('Comments');
	} finally {
		await f.dispose();
	}
}, 30000);
