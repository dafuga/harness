import { expect, test, vi } from 'vitest';
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
test('ModuleTaskToolBrokerAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-tool-broker'
	expect(new ModuleTaskToolBrokerAdapter().connect()).toBe('module-task-tool-broker');
});
test('ModuleTaskToolBrokerAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskToolBrokerAdapter({ name: 'custom' }).connect()).toBe('custom');
});
test('ModuleTaskToolBrokerAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskToolBrokerAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
async function brokerFixture() {
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
		broker: new ModuleTaskToolBrokerAdapter(scope, { invokeCli }),
		dispose: () => rm(base, { recursive: true, force: true })
	};
}
function safeContract() {
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
test('ModuleTaskToolBrokerAdapter.readContract projects metadata through fixed sealed CLI arguments', async () => {
	const f = await brokerFixture();
	try {
		const expected = safeContract();
		f.invokeCli.mockResolvedValue({
			manifest: { ...expected, owns: { source: ['secret.ts'] }, source: 'private source sentinel' },
			consumers: expected.consumers,
			tests: ['private-test.ts'],
			source: 'private source sentinel',
			unknown: 'private sentinel'
		});
		expect(await f.broker.readContract({ unitId: expected.id })).toEqual(expected);
		expect(f.invokeCli).toHaveBeenCalledExactlyOnceWith(['units', 'show', expected.id, '--json']);
		for (const unitId of [
			'../secret',
			'--help',
			'service.orders;cat secret',
			'Service.Orders',
			'service orders'
		]) {
			await expect(f.broker.readContract({ unitId })).rejects.toThrow();
		}
		expect(f.invokeCli).toHaveBeenCalledTimes(1);
		const failure = new Error('Synthetic CLI unavailable');
		f.invokeCli.mockRejectedValueOnce(failure);
		await expect(f.broker.readContract({ unitId: expected.id })).rejects.toThrow();
	} finally {
		await f.dispose();
	}
});
test('ModuleTaskToolBrokerAdapter.listContracts exposes only contract index metadata', async () => {
	const f = await brokerFixture();
	try {
		const expected = [{ id: 'service.orders', kind: 'service', responsibility: 'Validate orders' }];
		f.invokeCli.mockResolvedValue(
			expected.map((entry) => ({ ...entry, source: 'private source', tests: ['private.test.ts'] }))
		);
		expect(await f.broker.listContracts({})).toEqual(expected);
		expect(await f.broker.listContracts({ kind: 'service' })).toEqual(expected);
		expect(f.invokeCli.mock.calls).toEqual([
			[['units', 'list', '--json']],
			[['units', 'list', '--json', '--kind', 'service']]
		]);
		for (const kind of ['--help', 'service;cat secret', '../secret'])
			await expect(f.broker.listContracts({ kind })).rejects.toThrow();
		expect(f.invokeCli).toHaveBeenCalledTimes(2);
	} finally {
		await f.dispose();
	}
});
async function assertUnsafeFiles() {
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
test('ModuleTaskToolBrokerAdapter.readAssigned limits access to exact safe UTF-8 files', async () => {
	const f = await brokerFixture();
	try {
		expect(await f.broker.readAssigned({ path: 'src/assigned.ts' })).toEqual({
			text: 'original\n',
			sha256: sha('original\n')
		});
		for (const path of [
			'src/foreign.ts',
			'../secret',
			f.assigned,
			'./src/assigned.ts',
			'src/../src/assigned.ts',
			'src/ASSIGNED.ts',
			'src/assigned.ts\0',
			'src'
		]) {
			await expect(f.broker.readAssigned({ path })).rejects.toThrow();
			await expect(
				f.broker.writeAssigned({ path, expectedSha256: sha('original\n'), text: 'overwrite' })
			).rejects.toThrow();
		}
		expect(await readFile(f.assigned, 'utf8')).toBe('original\n');
		expect(await readFile(f.foreign, 'utf8')).toBe('synthetic credential sentinel');
		await writeFile(f.assigned, new Uint8Array([255, 254]));
		await expect(f.broker.readAssigned({ path: 'src/assigned.ts' })).rejects.toThrow();
		await writeFile(f.assigned, 'é'.repeat(524289));
		await expect(f.broker.readAssigned({ path: 'src/assigned.ts' })).rejects.toThrow();
		expect(f.invokeCli).not.toHaveBeenCalled();
	} finally {
		await f.dispose();
	}
	await assertUnsafeFiles();
});
test('ModuleTaskToolBrokerAdapter.writeAssigned enforces hashes and atomic bounded edits', async () => {
	const f = await brokerFixture();
	try {
		const path = 'src/assigned.ts',
			expectedSha256 = sha('original\n');
		for (const hash of ['bad', expectedSha256.toUpperCase(), '0'.repeat(64)]) {
			await expect(
				f.broker.writeAssigned({ path, expectedSha256: hash, text: 'bad' })
			).rejects.toThrow();
			expect(await readFile(f.assigned, 'utf8')).toBe('original\n');
		}
		await expect(
			f.broker.writeAssigned({ path, expectedSha256, text: 'é'.repeat(524289) })
		).rejects.toThrow();
		expect(await readFile(f.assigned, 'utf8')).toBe('original\n');
		const writes = await Promise.allSettled(
			['first edit', 'second edit'].map((text) =>
				f.broker.writeAssigned({ path, expectedSha256, text })
			)
		);
		expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(writes.filter((result) => result.status === 'rejected')).toHaveLength(1);
		const saved = await f.broker.readAssigned({ path });
		expect(['first edit', 'second edit']).toContain(saved.text);
		const large = 'é'.repeat(524288);
		expect(
			await f.broker.writeAssigned({ path, expectedSha256: saved.sha256, text: large })
		).toEqual({ sha256: sha(large) });
		expect(await f.broker.readAssigned({ path })).toEqual({ text: large, sha256: sha(large) });
		expect(await readFile(f.foreign, 'utf8')).toBe('synthetic credential sentinel');
		expect(f.invokeCli).not.toHaveBeenCalled();
	} finally {
		await f.dispose();
	}
});
