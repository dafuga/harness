import {
	assertSealedBroker,
	assertUnsafeFiles,
	brokerFixture,
	safeContract,
	sha,
	unscoped
} from './module-task-tool-broker.test.fixtures';
import { afterAll, expect, test, vi } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { ModuleTaskToolBrokerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskToolBrokerAdapter';
import { TestExpectationService } from '../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../src/core/development-tooling/unitTypes';
import manifest from '../../../specification/units/adapter.agents-providers-module-task-tool-broker.json' with { type: 'json' };
import { measureWorkload } from '../../support/measureWorkload';
async function readContractScopedNamed() {
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
		const actual = await f.broker.readContract({ unitId: expected.id });
		expect(actual).toEqual(expected);
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
		return actual;
	} finally {
		await f.dispose();
	}
}
async function listContractsScopedNamed() {
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
		return expected;
	} finally {
		await f.dispose();
	}
}
async function readAssignedScopedNamed() {
	const f = await brokerFixture();
	let actual: Awaited<ReturnType<ModuleTaskToolBrokerAdapter['readAssigned']>>;
	try {
		actual = await f.broker.readAssigned({ path: 'src/assigned.ts' });
		expect(actual).toEqual({
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
	return actual;
}
async function writeAssignedScopedNamed() {
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
		const actual = await f.broker.writeAssigned({
			path,
			expectedSha256: saved.sha256,
			text: large
		});
		expect(actual).toEqual({ sha256: sha(large) });
		expect(await f.broker.readAssigned({ path })).toEqual({ text: large, sha256: sha(large) });
		expect(await readFile(f.foreign, 'utf8')).toBe('synthetic credential sentinel');
		expect(f.invokeCli).not.toHaveBeenCalled();
		return actual;
	} finally {
		await f.dispose();
	}
}

async function scoped(method: 'connect' | 'readAssigned' | 'writeAssigned', named = false) {
	const f = await brokerFixture();
	try {
		const adapter = named ? f.broker : new ModuleTaskToolBrokerAdapter(f.scope);
		if (method === 'connect') return adapter.connect();
		if (method === 'readAssigned') return await adapter.readAssigned({ path: 'src/assigned.ts' });
		const result = await adapter.writeAssigned({
			path: 'src/assigned.ts',
			expectedSha256: sha('original\n'),
			text: 'default edit'
		});
		expect(await readFile(f.assigned, 'utf8')).toBe('default edit');
		expect(await readFile(f.foreign, 'utf8')).toBe('synthetic credential sentinel');
		return result;
	} finally {
		await f.dispose();
	}
}

vi.setConfig({ testTimeout: 60_000 });
afterAll(() => vi.resetConfig());
new TestExpectationService().registerCases(
	test,
	manifest as ComponentManifest,
	'test/adapters/agents-providers/module-task-tool-broker.test.ts',
	{
		'connect.default': () => new ModuleTaskToolBrokerAdapter().connect(),
		'connect.named': () => new ModuleTaskToolBrokerAdapter({ name: 'custom' }).connect(),
		'connect.invalid': () => {
			expect(() => new ModuleTaskToolBrokerAdapter(3 as never)).toThrow(TypeError);
			return new ModuleTaskToolBrokerAdapter(null).connect();
		},
		'connect.scoped': () => scoped('connect'),
		'connect.scoped-named': () => scoped('connect', true),
		'read-contract.default': () => unscoped('default', 'readContract'),
		'read-contract.named': () => unscoped('named', 'readContract'),
		'read-contract.invalid': () => unscoped('invalid', 'readContract'),
		'read-contract.scoped': () => assertSealedBroker(),
		'read-contract.scoped-named': readContractScopedNamed,
		'list-contracts.default': () => unscoped('default', 'listContracts'),
		'list-contracts.named': () => unscoped('named', 'listContracts'),
		'list-contracts.invalid': () => unscoped('invalid', 'listContracts'),
		'list-contracts.scoped': () => assertSealedBroker(),
		'list-contracts.scoped-named': listContractsScopedNamed,
		'read-assigned.default': () => unscoped('default', 'readAssigned'),
		'read-assigned.named': () => unscoped('named', 'readAssigned'),
		'read-assigned.invalid': () => unscoped('invalid', 'readAssigned'),
		'read-assigned.scoped': () => scoped('readAssigned'),
		'read-assigned.scoped-named': () =>
			measureWorkload(
				'adapter.agents-providers-module-task-tool-broker',
				'assigned-file-read-and-rejections',
				readAssignedScopedNamed
			),
		'write-assigned.default': () => unscoped('default', 'writeAssigned'),
		'write-assigned.named': () => unscoped('named', 'writeAssigned'),
		'write-assigned.invalid': () => unscoped('invalid', 'writeAssigned'),
		'write-assigned.scoped': () => scoped('writeAssigned'),
		'write-assigned.scoped-named': writeAssignedScopedNamed
	}
);
