import { expect } from 'vitest';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ModuleDataService } from '../../../src/services/git-source-history/ModuleDataService';
import { ModuleTaskContractContextService } from '../../../src/services/agents-providers/ModuleTaskContractContextService';
import { ModuleTaskToolBrokerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskToolBrokerAdapter';
import type { ModuleTask } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';

const execute = promisify(execFile);
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
async function git(root: string, ...args: string[]) {
	return (
		await execute('git', ['-C', root, ...args], { maxBuffer: 4 * 1024 * 1024 })
	).stdout.trim();
}

async function configureGit(root: string) {
	await git(root, 'config', 'user.name', 'Synthetic broker fixture');
	await git(root, 'config', 'user.email', 'fixture@example.invalid');
	await git(root, 'config', 'core.autocrlf', 'false');
}

async function prepareRepository(base: string, root: string) {
	const isRepository = await git(source, 'rev-parse', '--is-inside-work-tree').then(
		() => true,
		() => false
	);
	if (isRepository) {
		await git(base, 'clone', '--shared', '--no-checkout', source, root);
		await git(root, 'checkout', '--detach', 'HEAD');
		await configureGit(root);
		return;
	}
	// Verification snapshots are archive exports. Their disposable commit is not the tested revision.
	await cp(source, root, {
		recursive: true,
		verbatimSymlinks: true,
		filter: (path) => path !== join(source, 'node_modules') && path !== join(source, '.git')
	});
	await git(root, 'init', '-q', '-b', 'main');
	await configureGit(root);
	await git(root, 'add', '-A');
	const expectedTree = process.env.HARNESS_VERIFY_TREE;
	if (expectedTree && (await git(root, 'write-tree')) !== expectedTree)
		throw new Error('Synthetic fixture tree differs from the verified source tree');
	await git(root, 'commit', '-qm', 'chore: synthetic source fixture');
}

async function sealedFixture() {
	const base = await realpath(await mkdtemp(join(tmpdir(), 'sealed-broker-test-')));
	const root = join(base, 'repository'),
		worktree = join(base, 'worktree');
	let context: Awaited<ReturnType<ModuleTaskContractContextService['create']>> | undefined;
	try {
		await prepareRepository(base, root);
		await symlink(join(source, 'node_modules'), join(root, 'node_modules'));
		const commit = await git(root, 'rev-parse', 'HEAD');
		await git(root, 'worktree', 'add', '--detach', worktree, commit);
		const metadata = new ModuleDataService(root);
		await metadata.validate({ commit, write: true });
		const data = await metadata.require(commit);
		const files = ['src/services/agents-providers/FeaturePlanService.ts'];
		const task = {
			sourceCommit: commit,
			module: { id: 'service.agents-providers-feature-plan' }
		} as ModuleTask;
		context = await new ModuleTaskContractContextService(root).create(task, worktree, files);
		const scope = {
			root: worktree,
			files,
			snapshot: context.scope.snapshot,
			binDirectory: context.binDirectory,
			scratch: context.scope.scratch
		};
		return {
			scope,
			data,
			broker: new ModuleTaskToolBrokerAdapter(scope),
			dispose: async () => {
				await context!.cleanup();
				await rm(base, { recursive: true, force: true });
			}
		};
	} catch (error) {
		await context?.cleanup();
		await rm(base, { recursive: true, force: true });
		throw error;
	}
}

export async function assertSealedBroker() {
	const f = await sealedFixture();
	try {
		const selected = f.data.declarations.find(
			(unit) =>
				unit.id !== 'service.agents-providers-feature-plan' &&
				[...unit.contract.inputs, ...unit.contract.outputs, ...unit.contract.errors].some(
					(field) => field.examples?.length
				)
		);
		expect(
			selected,
			'A committed app-wide contract with authored examples is required.'
		).toBeDefined();
		const contract = await f.broker.readContract({ unitId: selected!.id });
		expect(contract).toMatchObject({
			id: selected!.id,
			kind: selected!.kind,
			contract: {
				inputs: selected!.contract.inputs,
				outputs: selected!.contract.outputs,
				errors: selected!.contract.errors
			}
		});
		for (const key of ['owns', 'source', 'tests']) expect(contract).not.toHaveProperty(key);
		expect(JSON.stringify(contract)).not.toContain('FeaturePlanService.ts');
		const units = await f.broker.listContracts({});
		expect(units).toEqual(expect.arrayContaining([expect.objectContaining({ id: selected!.id })]));
		for (const unit of units) {
			expect(Object.keys(unit).sort()).toEqual(['id', 'kind', 'responsibility']);
		}
		for (const unitId of ['../source', 'service.definitely-missing'])
			await expect(f.broker.readContract({ unitId })).rejects.toThrow();
		await expect(
			f.broker.readAssigned({ path: 'test/services/agents-providers/feature-plan.test.ts' })
		).rejects.toThrow();
		const invalid = new ModuleTaskToolBrokerAdapter({ ...f.scope, files: ['../outside.ts'] });
		await expect(invalid.readContract({ unitId: selected!.id })).rejects.toThrow();
		return {
			contractMatches: contract.id === selected!.id,
			catalogContainsContract: units.some((unit) => unit.id === selected!.id)
		};
	} finally {
		await f.dispose();
	}
}
