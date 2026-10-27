import { expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
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
import { join } from 'node:path';
import { ModuleTaskToolBrokerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskToolBrokerAdapter';

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
