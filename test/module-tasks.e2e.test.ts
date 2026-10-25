import { test } from 'vitest';
import { expect } from './verificationExpect';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { moduleTaskFixture } from './support/moduleTaskFixture';
import { runHarness } from './support/cli';
import { GitAdapter } from '../src/adapters/git-source-history/GitAdapter';

test('module task creation requires a wanted contract and leaves source HEAD and edits intact', async () => {
	const f = await moduleTaskFixture();
	try {
		expect((await f.feature(false)).exitCode, 'module feature context must be committed').toBe(0);
		const bad = await f.cli(
			['add', '--input', await f.input({ wantedContract: undefined })],
			false
		);
		expect(bad.exitCode).toBe(1);
		expect(bad.stderr).toContain('wantedContract');
		await writeFile(join(f.root, 'src/orders.ts'), 'uncommitted user edit');
		const added = JSON.parse((await f.cli(['add', '--input', await f.input(), '--json'])).stdout);
		expect(added.task.model).toBe('auto');
		expect(added.task.module.goal).toBe('Maintain the complete order lifecycle.');
		expect(added.task.sourceCommit).toBe(f.source);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
		expect(await readFile(join(f.root, 'src/orders.ts'), 'utf8')).toBe('uncommitted user edit');
		const committed = JSON.parse(await f.git.run(['show', `${added.commit}:queue.json`]));
		expect(committed.tasks[0].wantedContract.responsibility).toBe('Reject empty orders.');
	} finally {
		await f.dispose();
	}
}, 30000);

test('tasks share a stable goal-first prompt and keep their wanted contracts after a fresh fetch', async () => {
	const f = await moduleTaskFixture();
	const clone = await mkdtemp(join(tmpdir(), 'harness-task-clone-'));
	try {
		await f.feature();
		await f.cli(['add', '--input', await f.input()]);
		const first = (await f.cli(['prompt', 'orders-validation'])).stdout;
		await f.cli(['add', '--input', await f.input({ id: 'orders-errors' })]);
		const second = (await f.cli(['prompt', 'orders-errors'])).stdout;
		const prefix =
			'Overall goal: Make checkout reliable.\nFeature TLDR: Build validated orders and payment handling.\n';
		expect(first.startsWith(prefix)).toBe(true);
		expect(second.startsWith(prefix)).toBe(true);
		expect(first).toContain('Maintain the complete order lifecycle.');
		expect(first).toContain('Reject empty orders.');
		await new GitAdapter(clone).run(['clone', '-q', f.root, '.']);
		await runHarness(['task', 'sync', 'origin'], clone);
		const shown = JSON.parse(
			(await runHarness(['task', 'show', 'orders-validation', '--json'], clone)).stdout
		);
		expect(shown.task.wantedContract.responsibility).toBe('Reject empty orders.');
		expect(shown.task.sourceCommit).toBe(f.source);
	} finally {
		await f.dispose();
		await rm(clone, { recursive: true, force: true });
	}
}, 30000);

test.each([
	['claude-haiku-5-5', 'high', 'claude'],
	['gpt-6-luna', 'max', 'codex']
])(
	'assigned worker preserves explicit %s intelligence %s',
	async (model, intelligence, provider) => {
		const f = await moduleTaskFixture();
		try {
			await f.feature();
			await f.cli(['add', '--input', await f.input({ model, intelligence, assignee: 'owner' })]);
			await f.cli(['worker', '--worker', 'someone-else', '--once']);
			expect(
				JSON.parse((await f.cli(['show', 'orders-validation', '--json'])).stdout).task.status
			).toBe('queued');
			await f.cli(['worker', '--worker', 'owner', '--once', '--json']);
			const shown = JSON.parse((await f.cli(['show', 'orders-validation', '--json'])).stdout).task;
			expect(shown.status).toBe('review');
			expect(shown.result).toMatchObject({ provider, model, intelligence });
			const calls = (await readFile(join(f.root, 'calls.ndjson'), 'utf8'))
				.trim()
				.split('\n')
				.map((x) => JSON.parse(x));
			expect(calls).toHaveLength(1);
			expect(calls[0].provider).toBe(provider);
			expect(calls[0].args).toContain(model);
			expect(calls[0].args.join(' ')).toContain(intelligence);
			expect(calls[0].cwd).not.toBe(f.root);
			expect(await readFile(join(f.root, 'src/orders.ts'), 'utf8')).toBe(
				'export const orders = 1;\n'
			);
		} finally {
			await f.dispose();
		}
	},
	30000
);

test.each(['quota', 'auth'])(
	'auto falls back to Luna 6 max only for confirmed Claude quota (%s)',
	async (mode) => {
		const f = await moduleTaskFixture();
		try {
			await f.feature();
			await f.cli(['add', '--input', await f.input()]);
			await writeFile(join(f.root, 'mode'), mode);
			await f.cli(['worker', '--worker', 'owner', '--once', '--json'], mode === 'quota');
			const task = JSON.parse((await f.cli(['show', 'orders-validation', '--json'])).stdout).task;
			const calls = (await readFile(join(f.root, 'calls.ndjson'), 'utf8'))
				.trim()
				.split('\n')
				.map((x) => JSON.parse(x));
			expect(calls[0].args).toContain('claude-haiku-5-5');
			if (mode === 'quota') {
				expect(calls.map((x) => x.provider)).toEqual(['claude', 'codex']);
				expect(task.result).toMatchObject({
					provider: 'codex',
					model: 'gpt-6-luna',
					intelligence: 'max'
				});
				expect(task.status).toBe('review');
			} else {
				expect(calls).toHaveLength(1);
				expect(task.status).toBe('failed');
			}
		} finally {
			await f.dispose();
		}
	},
	30000
);

test('explicit Claude quota failure never silently substitutes another model', async () => {
	const f = await moduleTaskFixture();
	try {
		await f.feature();
		await f.cli([
			'add',
			'--input',
			await f.input({ model: 'claude-haiku-5-5', intelligence: 'high' })
		]);
		await writeFile(join(f.root, 'mode'), 'quota');
		const result = await f.cli(['worker', '--worker', 'owner', '--once'], false);
		expect(result.exitCode).toBe(1);
		expect((await readFile(join(f.root, 'calls.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(
			1
		);
	} finally {
		await f.dispose();
	}
}, 30000);

test('competing workers claim once and writes outside the module require review as failed', async () => {
	const f = await moduleTaskFixture();
	try {
		await f.feature();
		await f.cli(['add', '--input', await f.input()]);
		await writeFile(join(f.root, 'mode'), 'outside');
		await Promise.all([
			f.cli(['worker', '--worker', 'one', '--once'], false),
			f.cli(['worker', '--worker', 'two', '--once'], false)
		]);
		expect((await readFile(join(f.root, 'calls.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(
			1
		);
		const task = JSON.parse((await f.cli(['show', 'orders-validation', '--json'])).stdout).task;
		expect(task.status).toBe('failed');
		expect(task.result.error).toContain('outside');
	} finally {
		await f.dispose();
	}
}, 30000);
