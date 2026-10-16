import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { Buffer } from 'node:buffer';
import { recordCapture } from '../../../src/utils/recordCapture';
import type { Git } from '../src/utils/planGit';
import { planReads } from '../src/utils/planReads';

/**
 * The Git that planReads returns, called on a small deterministic Git that answers each command
 * with its own arguments, counts what reaches it and fails when told to. What each call was given
 * and what it answered is recorded as it happened.
 */
const sha = 'a'.repeat(40);
const plan = ['show', `${sha}:page.home/plan.json`];
type Case = { name: string; input: unknown; output: unknown };
function port(fails = 0, objectFormat: Git['objectFormat'] | null = 'sha1') {
	const calls: string[][] = [];
	const git: Git = {
		root: '/fixture',
		dir: '/fixture/.git',
		...(objectFormat ? { objectFormat } : {}),
		run: async (args) => {
			calls.push(args);
			if (fails-- > 0) throw new Error('transient Git failure');
			return Buffer.from(args.join(' '));
		}
	};
	return { git, calls };
}
async function call(
	cases: Case[],
	git: Git,
	args: string[],
	{ input, env }: { input?: string; env?: Record<string, string> } = {}
) {
	const asked = { args, ...(input === undefined ? {} : { input }), ...(env ? { env } : {}) };
	try {
		const bytes = await git.run(args, input, env);
		cases.push({ name: args[0], input: asked, output: bytes.toString() });
		return bytes;
	} catch (error) {
		cases.push({ name: args[0], input: asked, output: { error: (error as Error).message } });
		throw error;
	}
}
const trace = (file: string, cases: Case[], calls: string[][]) =>
	recordCapture(
		{
			evidence: 'planning-artifacts-reads',
			kind: 'trace',
			state: 'operation-read-isolation',
			file,
			mediaType: 'application/json'
		},
		JSON.stringify(
			{
				schemaVersion: 1,
				kind: 'function-invocations',
				unitId: 'planning.function.plan-reads',
				symbol: 'planReads',
				cases,
				reachedGit: calls
			},
			null,
			'\t'
		)
	);

test('concurrent pinned reads of one object share one Git call', async () => {
	const { git, calls } = port();
	const cases: Case[] = [];
	const reads = planReads(git);
	const answers = await Promise.all([call(cases, reads, plan), call(cases, reads, plan)]);
	expect(answers.map((bytes) => bytes.toString())).toEqual([plan.join(' '), plan.join(' ')]);
	expect(calls).toEqual([plan]);
	trace('plan-reads-concurrent.json', cases, calls);
});

test('each answer is its own copy of the bytes', async () => {
	const { git, calls } = port();
	const cases: Case[] = [];
	const reads = planReads(git);
	(await call(cases, reads, plan)).fill(0);
	expect((await call(cases, reads, plan)).toString()).toBe(plan.join(' '));
	expect(calls).toHaveLength(1);
	trace('plan-reads-copies.json', cases, calls);
});

test('HEAD, branches, short ids and a new operation read again', async () => {
	const { git, calls } = port();
	const cases: Case[] = [];
	const reads = planReads(git);
	const pinnedTree = ['ls-tree', '-z', sha, '--', 'page.home/plan.json'];
	for (const args of [
		['rev-parse', '--verify', 'HEAD^{commit}'],
		['ls-tree', '-z', 'main', '--', 'page.home/plan.json'],
		['show', 'aaaaaaa:page.home/plan.json'],
		pinnedTree
	]) {
		await call(cases, reads, args);
		await call(cases, reads, args);
	}
	await call(cases, planReads(git), pinnedTree);
	expect(calls).toHaveLength(8);
	trace('plan-reads-fresh.json', cases, calls);
});

test('a read that failed runs again', async () => {
	const { git, calls } = port(1);
	const cases: Case[] = [];
	const reads = planReads(git);
	await expect(call(cases, reads, plan)).rejects.toThrow('transient Git failure');
	expect((await call(cases, reads, plan)).toString()).toBe(plan.join(' '));
	expect(calls).toEqual([plan, plan]);
	trace('plan-reads-retry.json', cases, calls);
});

test('input, environment and writes always reach Git', async () => {
	const { git, calls } = port();
	const cases: Case[] = [];
	const reads = planReads(git);
	for (const [args, input, env] of [
		[plan, 'stdin', undefined],
		[plan, undefined, { GIT_INDEX_FILE: '/fixture/index' }],
		[['update-ref', 'refs/heads/main', sha], undefined, undefined],
		[['hash-object', '-w', '--stdin'], 'blob', undefined]
	] as Array<[string[], string | undefined, Record<string, string> | undefined]>) {
		await call(cases, reads, args, { input, env });
		await call(cases, reads, args, { input, env });
	}
	expect(calls).toHaveLength(8);
	trace('plan-reads-bypass.json', cases, calls);
});

test('a Git that states no format, or the other width, reads every name again', async () => {
	const cases: Case[] = [];
	const reached: string[][][] = [];
	const wide = ['show', `${'c'.repeat(64)}:page.home/plan.json`];
	for (const [objectFormat, args] of [
		[null, plan],
		['sha256', plan],
		['sha256', wide]
	] as Array<[Git['objectFormat'] | null, string[]]>) {
		const { git, calls } = port(0, objectFormat);
		const reads = planReads(git);
		await call(cases, reads, args);
		await call(cases, reads, args);
		reached.push(calls);
	}
	expect(reached.map((calls) => calls.length)).toEqual([2, 2, 1]);
	trace('plan-reads-formats-port.json', cases, reached.flat());
});
