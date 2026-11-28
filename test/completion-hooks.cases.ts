import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { moduleTaskFixture } from './support/moduleTaskFixture';
import { useInstalledPackage } from './support/moduleTaskPackage';

const models = [
	['claude-haiku-5-5', 'claude'],
	['gpt-6.2-sol', 'codex']
] as const;
// Managed fixtures may wait for an execution slot when the full suite is busy.
const orchestrationTimeoutMs = 60_000;

test.each(models)(
	'managed %s orchestration simplifies the contract before success and records the result',
	async (model, provider) => {
		const f = await moduleTaskFixture({ checks: [] });
		try {
			await writeFile(join(f.root, 'mode'), 'completion-orchestrator');
			await writeFile(
				join(f.root, 'brief.md'),
				'Write the order validation contract in contract.md.'
			);
			const response = await f.cli([
				'orchestrate',
				'--tracker=pilot1',
				'--brief=brief.md',
				`--model=${model}`
			]);
			expect(JSON.parse(response.stdout)).toMatchObject({ status: 'succeeded', provider });
			expect(await readFile(join(f.root, 'contract.md'), 'utf8')).toBe(
				'Validate before storing orders.\n'
			);
			const notes = (await readFile(join(f.root, 'tracker.ndjson'), 'utf8')).trim().split('\n');
			expect(notes).toHaveLength(1);
			expect(JSON.parse(notes[0])).toMatchObject([
				'note',
				'pilot1',
				expect.stringContaining('simplify-contract passed')
			]);
			const calls = await readFile(join(f.root, 'calls.ndjson'), 'utf8');
			expect(calls).not.toContain('Harness completion check: security-review');
		} finally {
			await f.dispose();
		}
	},
	orchestrationTimeoutMs
);

test.each(models)(
	'managed %s module handoff retains measured reductions despite an optional failure',
	async (model, provider) => {
		const f = await moduleTaskFixture({
			checks: [{ name: 'security-review', scope: 'module', enabled: true }]
		});
		try {
			await f.feature();
			await writeFile(join(f.root, 'mode'), 'completion-module');
			await f.cli([
				'add',
				'--input',
				await f.input({ model, verificationFiles: ['src/orders.test.ts'] })
			]);
			const run = JSON.parse(
				(await f.cli(['worker', '--worker=owner', '--once', '--json'])).stdout
			);
			expect(run.status).toBe('review');
			const receipt = await completionReceipt(run.result.text);
			expect(receipt).toMatchObject({
				scope: 'module',
				provider,
				checks: [
					{ name: 'reduce-module-bytes', status: 'passed', disposition: 'applied' },
					{
						name: 'security-review',
						status: 'failed',
						required: false,
						summary: 'Implemented order validation.'
					}
				]
			});
			const check = receipt.checks[0];
			expect(check.after.bytes.source).toBeLessThan(check.before.bytes.source);
			expect(check.after.bytes.tests).toBeLessThan(check.before.bytes.tests);
			expect(check.after.coverage['src/orders.ts'].lines.percent).toBe(100);
			expect(check.before.coverage['src/orders.ts'].lines.percent).toBe(100);
			expect(
				await f.git.run(['show', `${run.result.checkpointCommit}:src/orders.ts`])
			).not.toContain('Comments');
		} finally {
			await f.dispose();
		}
	},
	30000
);

const baselineCheck = {
	argv: [
		'bun',
		'--eval',
		"process.exit((await Bun.file('src/orders.ts').text()).includes('Comments') ? 0 : 1)"
	]
};

test.each([
	'completion-coverage-loss',
	'completion-test-failure',
	'completion-declared-check',
	'completion-provider-rejected'
])(
	'managed module completion discards %s and preserves the verified baseline',
	async (mode) => {
		const f = await moduleTaskFixture({ checks: [] });
		try {
			await f.feature();
			await writeFile(join(f.root, 'mode'), mode);
			const check = mode === 'completion-declared-check' ? baselineCheck : undefined;
			await f.cli([
				'add',
				'--input',
				await f.input({
					model: 'claude-haiku-5-5',
					verificationFiles: ['src/orders.test.ts'],
					check
				})
			]);
			const run = await f.cli(
				['worker', '--worker=owner', '--once', '--allow-task-checks', '--json'],
				false
			);
			expect(run.exitCode).toBe(0);
			const { result, status } = JSON.parse(run.stdout);
			expect(status).toBe('review');
			const receipt = await completionReceipt(result.text);
			expect(receipt.checks[0]).toMatchObject({
				name: 'reduce-module-bytes',
				status: 'passed',
				disposition: 'discarded',
				before: { testExitCode: 0 }
			});
			if (mode === 'completion-provider-rejected') {
				expect(receipt.checks[0].summary).toBe(
					'Removed redundant comments and condensed test layout.'
				);
				expect(receipt.checks[0].after).toBeUndefined();
			} else {
				expect(receipt.checks[0].after.testExitCode).toBe(
					mode === 'completion-test-failure' ? 1 : 0
				);
			}
			if (check) {
				expect(result.checkRounds).toMatchObject([{ status: 'passed', exitCode: 0 }]);
				expect(receipt.checks[0].candidateCheck).toMatchObject({ status: 'failed', exitCode: 1 });
			}
			expect(await readFile(join(result.worktree, 'src/orders.test.ts'), 'utf8')).toContain(
				'expect(orders(false)).toBe(0)'
			);
			expect(await readFile(join(result.worktree, 'src/orders.ts'), 'utf8')).toContain('Comments');
		} finally {
			await f.dispose();
		}
	},
	30000
);

test('managed module completion verifies with the repository installed packages', async () => {
	const f = await moduleTaskFixture({ checks: [] });
	try {
		await useInstalledPackage(f);
		await f.feature();
		await writeFile(join(f.root, 'mode'), 'completion-module');
		await f.cli([
			'add',
			'--input',
			await f.input({ model: 'claude-haiku-5-5', verificationFiles: ['src/orders.test.ts'] })
		]);
		const worker = await f.cli(['worker', '--worker=owner', '--once', '--json'], false);
		const run = JSON.parse(worker.stdout);
		const receipt = await completionReceipt(run.result.text);
		expect(receipt.checks[0]).toMatchObject({
			name: 'reduce-module-bytes',
			status: 'passed',
			disposition: 'applied',
			before: { testExitCode: 0 },
			after: { testExitCode: 0 }
		});
		expect(run.status).toBe('review');
		expect(worker.exitCode).toBe(0);
	} finally {
		await f.dispose();
	}
}, 30000);

async function completionReceipt(text: string) {
	const path = text.match(/^Completion record: (.+)$/m)?.[1];
	expect(path, 'worker result links its completion record').toBeDefined();
	return JSON.parse(await readFile(path!, 'utf8'));
}
