import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, sep } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskContractContextService } from '../../../src/services/agents-providers/ModuleTaskContractContextService';
import { ModuleDataService } from '../../../src/services/git-source-history/ModuleDataService';

const feature = {
	id: 'contract-first-execution',
	goal: 'Harness users and agents develop from committed contracts; server-managed workers can read app-wide contracts and modify only their assigned files, with complete metadata validation and tracked executions.',
	tldr: 'Extend the API-backed CLI and mandatory revision metadata with contract authoring, contract-first Codex guidance, enforced worker scopes, and automatic server task creation and dispatch. Preserve local and hosted permissions, existing history and exact model/usage/cost/bounce records.'
};
const grant = ['src/worker.ts'];
const contract = (label: string) => ({
	origin: 'declared',
	inputs: [],
	outputs: [{ name: 'result', type: 'string', description: label }],
	errors: []
});
const wantedContract = {
	responsibility: 'Create a sealed contract-only task context.',
	inputs: [{ name: 'task', type: 'ModuleTask' }],
	outputs: [{ name: 'context', type: 'ModuleTaskContractContext' }],
	errors: [{ name: 'missing metadata', type: 'prelaunch rejection' }]
};

async function write(root: string, path: string, value: string | object): Promise<void> {
	const file = join(root, path);
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function manifest(id: string, path: string, label: string, dependencies: object[] = []) {
	return {
		schemaVersion: 1,
		id,
		kind: 'service',
		title: id,
		responsibility: `Owns ${id}.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [path], symbols: [`${id}.run`] },
		contract: contract(label),
		dependencies,
		runtime: { kind: 'module', entry: path, targets: [{ kind: 'module', entry: path }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}
function git(root: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
function commit(root: string, message: string): void {
	git(root, 'add', '-A');
	git(root, 'commit', '-m', message);
}
async function validateMetadata(root: string, revision: string): Promise<void> {
	const service = new ModuleDataService(root);
	const report = await service.validate({ commit: revision, write: true });
	if (!report.valid || !report.committed) console.error(JSON.stringify(report));
	expect(report).toMatchObject({ valid: true, committed: true });
	await service.require(revision, 'service.worker');
}
async function seed(root: string, revision: string): Promise<void> {
	const foreign = `foreign-contract-${revision}`;
	await Promise.all([
		write(root, 'src/worker.ts', `WORKER_SOURCE_${revision}`),
		write(root, 'src/foreign.ts', `FOREIGN_SOURCE_${revision}`),
		write(
			root,
			'specification/units/service.worker.json',
			manifest('service.worker', grant[0], `worker-contract-${revision}`, [
				{ unit: 'service.foreign', via: 'contract', origin: 'declared', contract: foreign }
			])
		),
		write(
			root,
			'specification/units/service.foreign.json',
			manifest('service.foreign', 'src/foreign.ts', `foreign-contract-${revision}`)
		)
	]);
}
async function makeFixture() {
	const temporary = await realpath(await mkdtemp(join(tmpdir(), 'harness-contract-context-')));
	const root = join(temporary, 'repo'),
		worktree = join(temporary, 'worker');
	const blockedGit = join(temporary, 'blocked');
	try {
		await mkdir(root);
		await mkdir(blockedGit);
		git(root, 'init');
		git(root, 'config', 'user.name', 'Fixture');
		git(root, 'config', 'user.email', 'fixture@example.invalid');
		await writeFile(join(blockedGit, 'git'), '#!/bin/sh\nexit 91\n', { mode: 0o755 });
		await seed(root, 'v1');
		commit(root, 'source v1');
		const sourceCommit = git(root, 'rev-parse', 'HEAD');
		await validateMetadata(root, sourceCommit);
		const queue = new ModuleTaskService(root);
		await queue.feature(feature);
		const { task } = await queue.add({
			id: 'contract-context-fixture',
			title: 'Contract context fixture',
			feature: feature.id,
			module: 'service.worker',
			instructions: 'Read contracts only.',
			wantedContract,
			model: 'gpt-6-luna',
			provider: 'codex',
			intelligence: 'max'
		});
		git(root, 'worktree', 'add', '--detach', worktree, sourceCommit);
		await seed(root, 'v2');
		commit(root, 'source v2');
		await write(worktree, 'src/foreign.ts', 'WORKTREE_SOURCE_SECRET');
		return { temporary, root, worktree, blockedGit, sourceCommit, task };
	} catch (error) {
		await rm(temporary, { recursive: true, force: true });
		throw error;
	}
}
async function withFixture(work: (f: Awaited<ReturnType<typeof makeFixture>>) => Promise<void>) {
	const f = await makeFixture();
	try {
		await work(f);
	} finally {
		await rm(f.temporary, { recursive: true, force: true });
	}
}
function createContext(root: string, task: unknown, worktree: string, files: string[]) {
	const service = Reflect.construct(ModuleTaskContractContextService, [root]);
	const create = Reflect.get(service, 'create');
	expect(create).toBeTypeOf('function');
	return Reflect.apply(create, service, [task, worktree, files]);
}
function runCli(bin: string, f: Awaited<ReturnType<typeof makeFixture>>, args: string[]) {
	const path = [bin, f.blockedGit, dirname(process.execPath), '/usr/bin', '/bin'].join(delimiter);
	return spawnSync(join(bin, 'harness'), args, {
		cwd: f.worktree,
		encoding: 'utf8',
		env: { HOME: f.temporary, PATH: path }
	});
}
const overlaps = (a: string, b: string) =>
	a === b || a.startsWith(b + sep) || b.startsWith(a + sep);

test('seals an exact contract-only scope and preserves concurrent workspaces', async () =>
	withFixture(async (f) => {
		await write(f.root, 'root-sentinel.txt', 'keep-root');
		await write(f.worktree, 'worktree-sentinel.txt', 'keep-worktree');
		const first = await createContext(f.root, f.task, f.worktree, grant);
		const second = await createContext(f.root, f.task, f.worktree, grant);
		try {
			const { scope, binDirectory } = first;
			expect(scope.files).toEqual(grant);
			expect(
				[scope.snapshot, scope.scratch, binDirectory, ...scope.readPaths].every(isAbsolute)
			).toBe(true);
			expect(scope.protectedPaths).toEqual(
				expect.arrayContaining([f.root, join(f.root, '.git'), f.worktree])
			);
			expect(
				scope.readPaths.some((p: string) => [f.root, f.worktree].some((r) => overlaps(p, r)))
			).toBe(false);
			expect(
				[scope.snapshot, binDirectory].some((p: string) => p.startsWith(`${scope.scratch}/`))
			).toBe(false);
			expect((await stat(scope.snapshot)).mode & 0o222).toBe(0);
			expect((await stat(join(binDirectory, 'harness'))).mode & 0o222).toBe(0);
			expect(existsSync(join(f.worktree, 'node_modules'))).toBe(false);
			const list = runCli(binDirectory, f, ['units', 'list', '--json']);
			const foreign = runCli(binDirectory, f, ['units', 'show', 'service.foreign', '--json']);
			const deps = runCli(binDirectory, f, ['api', 'contracts', 'get', 'service.worker']);
			for (const result of [list, foreign, deps]) expect(result.status).toBe(0);
			expect(list.stdout).toContain(f.sourceCommit);
			expect(foreign.stdout).toContain('foreign-contract-v1');
			expect(foreign.stdout).not.toContain('foreign-contract-v2');
			expect(deps.stdout).toMatch(/service\.foreign[\s\S]*foreign-contract-v1/);
			expect(`${list.stdout}${foreign.stdout}${deps.stdout}`).not.toContain('_SOURCE_');
			await first.cleanup();
			expect(existsSync(first.scope.scratch)).toBe(false);
			expect(
				existsSync(join(f.root, 'root-sentinel.txt')) &&
					existsSync(join(f.worktree, 'worktree-sentinel.txt'))
			).toBe(true);
			expect(runCli(second.binDirectory, f, ['units', 'list', '--json']).status).toBe(0);
		} finally {
			await second.cleanup();
		}
	}));

test('rejects missing metadata, forbidden commands and tampered snapshots safely', async () =>
	withFixture(async (f) => {
		const missing = { ...f.task, module: { ...f.task.module, id: 'service.missing' } };
		await expect(createContext(f.root, missing, f.worktree, grant)).rejects.toThrow();
		const context = await createContext(f.root, f.task, f.worktree, grant);
		try {
			for (const args of [
				['units', 'show', 'service.missing', '--json'],
				['task', 'add'],
				['api', 'contracts', 'define'],
				['source', 'read', 'src/foreign.ts']
			]) {
				const result = runCli(context.binDirectory, f, args);
				expect(result.status).not.toBe(0);
				expect(result.stdout + result.stderr).not.toMatch(/(?:WORKER|FOREIGN|WORKTREE)_SOURCE/);
			}
			await chmod(context.scope.snapshot, 0o600);
			await writeFile(context.scope.snapshot, '{tampered');
			const result = runCli(context.binDirectory, f, ['units', 'list', '--json']);
			expect(result.status).not.toBe(0);
			expect(result.stdout + result.stderr).toMatch(/snapshot|hash|integrity|tamper/i);
		} finally {
			await context.cleanup();
		}
	}));
