import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskWorktreeAdapter } from '../../../src/adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';
import { UnitRegistryRepository } from '../../../src/repositories/verification-evidence/UnitRegistryRepository';
import { ModuleDataService } from '../../../src/services/git-source-history/ModuleDataService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { observedTaskOperation } from '../../support/taskProfiles';

const metadataFixture = async () => {
	const f = await moduleTaskFixture();
	try {
		await f.git.run(['config', 'user.name', 'Checkpoint Test']);
		await f.git.run(['config', 'user.email', 'checkpoint@example.test']);
		await new UnitRegistryRepository(f.root).write([
			{
				schemaVersion: 1,
				id: 'service.orders',
				kind: 'service',
				title: 'Orders fixture',
				responsibility: 'Exercise source-bound task checkpoints.',
				responsibilityOrigin: 'declared',
				status: 'active',
				owns: { source: ['src/orders.ts'], symbols: ['orders'] },
				contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
				dependencies: [],
				runtime: {
					kind: 'module',
					entry: 'src/orders.ts',
					targets: [{ kind: 'module', entry: 'src/orders.ts' }]
				},
				scenarios: [],
				budgets: {
					size: 'frozen',
					complexity: 'frozen',
					performance: [{ workload: 'task-fixture', metric: 'latency-cold-ms', tolerance: 0.05 }]
				}
			}
		]);
		await f.git.run(['add', 'specification/units']);
		await f.git.run(['commit', '-m', 'test: seed complete module manifest']);
		const source = await f.git.run(['rev-parse', 'HEAD']);
		const report = await new ModuleDataService(f.root).validate({ commit: source, write: true });
		expect(report.committed).toBe(true);
		expect(report.evidenceGaps).toBeGreaterThan(0);
		expect(report.issues).toEqual([]);
		expect(
			report.modules.flatMap((unit) => unit.issues).every((issue) => issue.kind === 'evidence')
		).toBe(true);
		const cwd = join(f.root, 'review');
		await f.git.run(['worktree', 'add', '--detach', cwd, source]);
		return { f, source, cwd, git: new GitAdapter(cwd) };
	} catch (error) {
		await f.dispose();
		throw error;
	}
};

test('submission checkpoint preserves source HEAD and both staged and unstaged work', async () => {
	const f = await moduleTaskFixture();
	try {
		const cwd = join(f.root, 'review');
		await f.git.run(['worktree', 'add', '--detach', cwd, f.source]);
		const git = new GitAdapter(cwd);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 2;');
		await git.run(['add', 'src/orders.ts']);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 3;');
		await writeFile(join(cwd, 'new.txt'), 'review context');
		const checkpoint = await observedTaskOperation(
			'adapter.agents-providers-module-task-worktree',
			'snapshot-submission-with-private-index',
			() =>
				new ModuleTaskWorktreeAdapter(f.root).checkpoint({
					cwd,
					source: f.source,
					paths: ['src/orders.ts', 'new.txt']
				})
		);
		expect(await git.run(['show', checkpoint + ':src/orders.ts'])).toContain('orders = 3');
		expect(await git.run(['show', checkpoint + ':new.txt'])).toBe('review context');
		expect(await git.run(['show', ':src/orders.ts'])).toContain('orders = 2');
		expect(await git.run(['rev-parse', 'HEAD'])).toBe(f.source);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
	} finally {
		await f.dispose();
	}
});

test('changed checkpoint is readable with committed metadata and preserves user refs and indexes', async () => {
	const { f, source, cwd, git } = await metadataFixture();
	try {
		const rootIndex = await f.git.run(['write-tree']);
		const worktreeIndex = await git.run(['write-tree']);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 2;');
		await git.run(['add', 'src/orders.ts']);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 3;');
		await writeFile(join(cwd, 'new.txt'), 'review context');
		const checkpoint = await new ModuleTaskWorktreeAdapter(f.root).checkpoint({
			cwd,
			source,
			paths: ['src/orders.ts', 'new.txt']
		});
		expect(await git.run(['rev-parse', `${checkpoint}^`])).toBe(source);
		const metadata = new ModuleDataService(f.root);
		const data = await metadata.require(checkpoint);
		const report = await metadata.validate({ commit: checkpoint });
		expect(data.commit).toBe(checkpoint);
		expect(data.declarations.map((unit) => unit.id)).toContain('service.orders');
		expect(report.commit).toBe(checkpoint);
		expect(report.committed).toBe(true);
		expect(report.evidenceGaps).toBeGreaterThan(0);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(source);
		expect(await git.run(['rev-parse', 'HEAD'])).toBe(source);
		expect(await f.git.run(['write-tree'])).toBe(rootIndex);
		expect(await git.run(['write-tree'])).toBe(worktreeIndex);
		expect(await git.run(['show', checkpoint + ':src/orders.ts'])).toContain('orders = 3');
		expect(await git.run(['show', ':src/orders.ts'])).toContain('orders = 1');
		expect(await git.run(['show', '-s', '--format=%an <%ae>', checkpoint])).toBe(
			'Checkpoint Test <checkpoint@example.test>'
		);
	} finally {
		await f.dispose();
	}
});

test('empty checkpoint returns its source with readable metadata', async () => {
	const { f, source, cwd } = await metadataFixture();
	try {
		const checkpoint = await new ModuleTaskWorktreeAdapter(f.root).checkpoint({
			cwd,
			source,
			paths: []
		});
		expect(checkpoint).toBe(source);
		expect((await new ModuleDataService(f.root).require(checkpoint)).commit).toBe(source);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(source);
	} finally {
		await f.dispose();
	}
});

test('checkpoint rejects a foreign repository and a changed worktree HEAD', async () => {
	const fixture = await metadataFixture();
	const foreign = await moduleTaskFixture();
	try {
		await expect(
			new ModuleTaskWorktreeAdapter(fixture.f.root).checkpoint({
				cwd: foreign.root,
				source: foreign.source,
				paths: []
			})
		).rejects.toThrow();
		await writeFile(join(fixture.cwd, 'src/orders.ts'), 'export const orders = 9;');
		await fixture.git.run(['add', 'src/orders.ts']);
		await fixture.git.run(['commit', '-m', 'test: move worktree head']);
		await expect(
			new ModuleTaskWorktreeAdapter(fixture.f.root).checkpoint({
				cwd: fixture.cwd,
				source: fixture.source,
				paths: ['src/orders.ts']
			})
		).rejects.toThrow();
	} finally {
		await foreign.dispose();
		await fixture.f.dispose();
	}
});
