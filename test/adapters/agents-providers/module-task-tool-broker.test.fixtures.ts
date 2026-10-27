import { expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
	link,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
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
async function sealedFixture() {
	const base = await realpath(await mkdtemp(join(tmpdir(), 'sealed-broker-test-')));
	const root = join(base, 'repository'),
		worktree = join(base, 'worktree');
	let context: Awaited<ReturnType<ModuleTaskContractContextService['create']>> | undefined;
	try {
		await git(base, 'clone', '--shared', '--no-checkout', source, root);
		await git(root, 'checkout', '--detach', 'HEAD');
		await git(root, 'config', 'user.name', 'Synthetic broker fixture');
		await git(root, 'config', 'user.email', 'fixture@example.invalid');
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

export const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
export async function brokerFixture() {
	const base = await realpath(await mkdtemp(join(tmpdir(), 'tool-broker-test-')));
	const root = join(base, 'worktree'),
		binDirectory = join(base, 'bin'),
		scratch = join(base, 'scratch');
	for (const path of [join(root, 'src'), binDirectory, scratch])
		await mkdir(path, { recursive: true });
	const assigned = join(root, 'src/assigned.ts'),
		foreign = join(root, 'src/foreign.ts');
	await writeFile(assigned, 'original\n');
	await writeFile(foreign, 'synthetic credential sentinel');
	const snapshot = join(base, 'snapshot.json');
	await writeFile(snapshot, '{}');
	const scope = { root, files: ['src/assigned.ts'], snapshot, binDirectory, scratch };
	const invokeCli = vi.fn(async (_argv: string[]): Promise<unknown> => ({}));
	return {
		base,
		root,
		assigned,
		foreign,
		scope,
		invokeCli,
		broker: new ModuleTaskToolBrokerAdapter(scope, { name: 'custom', invokeCli }),
		dispose: () => rm(base, { recursive: true, force: true })
	};
}
export function safeContract() {
	return {
		id: 'service.orders',
		kind: 'service',
		title: 'Orders',
		responsibility: 'Validate orders',
		contract: { inputs: [], outputs: [{ name: 'valid', type: 'boolean' }], errors: [] },
		dependencies: [{ unit: 'model.orders', via: 'import' }],
		consumers: ['page.orders']
	};
}

export async function assertUnsafeFiles() {
	for (const kind of ['symlink', 'hardlink', 'directory', 'parent-symlink']) {
		const f = await brokerFixture();
		try {
			await f.broker.readAssigned({ path: 'src/assigned.ts' });
			if (kind === 'parent-symlink') {
				await rename(join(f.root, 'src'), join(f.base, 'foreign-dir'));
				await symlink(join(f.base, 'foreign-dir'), join(f.root, 'src'));
			} else {
				await rm(f.assigned);
				if (kind === 'symlink') await symlink(f.foreign, f.assigned);
				if (kind === 'hardlink') await link(f.foreign, f.assigned);
				if (kind === 'directory') await mkdir(f.assigned);
			}
			await expect(f.broker.readAssigned({ path: 'src/assigned.ts' })).rejects.toThrow();
			await expect(
				f.broker.writeAssigned({
					path: 'src/assigned.ts',
					expectedSha256: sha('synthetic credential sentinel'),
					text: 'overwrite'
				})
			).rejects.toThrow();
			expect(await readFile(f.foreign, 'utf8')).toBe('synthetic credential sentinel');
			expect(f.invokeCli).not.toHaveBeenCalled();
		} finally {
			await f.dispose();
		}
	}
}

export function unscoped(
	state: 'default' | 'named' | 'invalid',
	method: 'readContract' | 'listContracts' | 'readAssigned' | 'writeAssigned'
) {
	const adapter =
		state === 'default'
			? new ModuleTaskToolBrokerAdapter()
			: new ModuleTaskToolBrokerAdapter(state === 'named' ? { name: 'custom' } : null);
	const actions = {
		readContract: () => adapter.readContract({ unitId: 'service.orders' }),
		listContracts: () => adapter.listContracts({}),
		readAssigned: () => adapter.readAssigned({ path: 'src/assigned.ts' }),
		writeAssigned: () =>
			adapter.writeAssigned({ path: 'src/assigned.ts', expectedSha256: '0'.repeat(64), text: 'x' })
	};
	return actions[method]();
}
