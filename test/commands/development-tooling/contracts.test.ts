import { rm, rename } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';
import { contractsProject, writeContract } from '../../support/contractsProject';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';
import { assertLinearContractMap } from '../../support/contractMapWork';

vi.mock('node:fs/promises', { spy: true });

let fixture: Awaited<ReturnType<typeof contractsProject>>;
function contractCase(name: string, body: () => Promise<void>) {
	test(name, () =>
		withTempDir('harness-contracts-', async (root) => {
			fixture = await contractsProject(root);
			try {
				await body();
			} finally {
				vi.restoreAllMocks();
			}
		})
	);
}

async function run(...args: string[]) {
	const output: string[] = [];
	const program = (await loadCliProgram(['contracts', ...args])).exitOverride();
	const pending = [...program.commands];
	for (const command of pending) {
		command.exitOverride();
		pending.push(...command.commands);
	}
	program.configureOutput({ writeOut: (text) => output.push(text), writeErr: () => {} });
	const logged = vi.spyOn(console, 'log').mockImplementation((text) => output.push(String(text)));
	try {
		await measureWorkload('command.development-tooling-contracts', args[0], () =>
			program.parseAsync(['contracts', ...args, '--root', fixture.root], { from: 'user' })
		).catch((error: { code?: string }) => {
			if (error.code !== 'commander.helpDisplayed') throw error;
		});
		return output.join('\n');
	} finally {
		logged.mockRestore();
	}
}

contractCase('ContractsCommand runs', async () => {
	const help = await run('--help');
	for (const verb of ['show', 'list', 'search', 'map']) expect(help).toContain(verb);
});

contractCase(
	'ContractsCommand show resolves stored identity and owned paths without reading source',
	async () => {
		const reads = vi.spyOn(fs, 'readFile');
		const lists = vi.spyOn(fs, 'readdir');
		reads.mockClear();
		lists.mockClear();
		for (const query of [
			fixture.price.id,
			fixture.price.owns.source[0],
			join(fixture.root, fixture.price.owns.source[0]),
			'src/services/billing/'
		]) {
			const results = JSON.parse(await run('show', query, '--json'));
			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({
				id: fixture.price.id,
				contractPath: 'specification/units/nested/price.json',
				manifest: fixture.price
			});
		}
		expect(await run('show', fixture.price.id)).toContain('Subtotal in EUR.');
		expect(
			reads.mock.calls.every(([path]) => /\/specification\/(units|scenarios)\//.test(String(path)))
		).toBe(true);
		expect(
			lists.mock.calls.every(([path]) => /\/specification\/(units|scenarios)/.test(String(path)))
		).toBe(true);
		await expect(run('show', '../outside')).rejects.toThrow(/outside|within/i);
		await expect(run('show', 'unknown.unit')).rejects.toThrow(/No contracts/i);
	}
);

contractCase(
	'ContractsCommand list filters area folder kind and retirement with concise rows',
	async () => {
		expect(
			JSON.parse(await run('list', '--folder', 'src/services/billing', '--json')).map(
				(row: { id: string }) => row.id
			)
		).toEqual([fixture.price.id]);
		expect(
			JSON.parse(await run('list', '--area', 'billing', '--kind', 'model', '--json'))
		).toMatchObject([{ id: fixture.invoice.id }]);
		expect((await run('list', '--kind', 'service')).split('\n')).toHaveLength(3);
		expect(await run('list', '--kind', 'service')).toContain('src/services/billing/Price.ts');
		expect(JSON.parse(await run('list', '--include-retired', '--json'))).toHaveLength(5);
		await expect(run('list', '--limit', '-1')).rejects.toThrow(/positive integer/i);
	}
);

contractCase(
	'ContractsCommand search ranks contract fields and distinguishes literal regex and case',
	async () => {
		for (const query of [
			'service.price',
			'PriceService',
			'charging',
			'Money',
			'PriceQuote',
			'RangeError',
			'model.invoice',
			'price-loading',
			'quote-pending',
			'Waiting for currency'
		])
			expect(
				JSON.parse(await run('search', query, '--json')).some(
					(row: { id: string; snippet: string }) =>
						row.id === fixture.price.id && row.snippet.includes(query)
				)
			).toBe(true);
		expect(JSON.parse(await run('search', fixture.price.id, '--json'))[0].id).toBe(
			fixture.price.id
		);
		expect(JSON.parse(await run('search', 'money', '--json'))).toEqual([]);
		expect(JSON.parse(await run('search', 'money', '-i', '--json'))).toHaveLength(1);
		expect(JSON.parse(await run('search', '^Price(S|Q)', '--regex', '--json'))).toHaveLength(1);
		expect(JSON.parse(await run('search', '^Price(S|Q)', '--json'))).toEqual([]);
		expect(JSON.parse(await run('search', 'SOURCE_ONLY_SECRET', '--json'))).toEqual([]);
		expect(JSON.parse(await run('search', 'service', '--limit', '1', '--json'))).toHaveLength(1);
		await expect(run('search', '[', '--regex')).rejects.toThrow(/Invalid regular expression/i);
		await expect(run('search', '')).rejects.toThrow(/empty/i);
	}
);

contractCase(
	'ContractsCommand map separates dependencies and dependents at path boundaries',
	async () => {
		await assertLinearContractMap();
		const mapped = JSON.parse(await run('map', 'src/services/billing', '--json'));
		expect(mapped.matches.map((row: { id: string }) => row.id)).toEqual([fixture.price.id]);
		expect(mapped.dependencies.map((row: { id: string }) => row.id)).toEqual([fixture.invoice.id]);
		expect(mapped.dependents.map((row: { id: string }) => row.id)).toEqual([fixture.checkout.id]);
		expect(mapped.unresolved).toEqual([]);
		expect(
			JSON.parse(await run('map', fixture.price.id, '--depth', '0', '--json')).dependencies
		).toEqual([]);
		await writeContract(fixture.root, 'nested/price.json', {
			...fixture.price,
			dependencies: [{ unit: 'missing.unit', via: 'contract', origin: 'declared' }]
		});
		expect(JSON.parse(await run('map', fixture.price.id, '--json')).unresolved).toEqual([
			'missing.unit'
		]);
	}
);

contractCase(
	'ContractsCommand reloads moved edited deleted and invalid stored manifests',
	async () => {
		await run('list');
		await rename(
			join(fixture.root, 'specification/units/nested/price.json'),
			join(fixture.root, 'specification/units/relocated.json')
		);
		expect(JSON.parse(await run('show', fixture.price.id, '--json'))[0].contractPath).toBe(
			'specification/units/relocated.json'
		);
		await writeContract(fixture.root, 'relocated.json', {
			...fixture.price,
			responsibility: 'Fresh contract description.'
		});
		expect(await run('search', 'Fresh contract')).toContain(fixture.price.id);
		await rm(join(fixture.root, 'specification/units/relocated.json'));
		expect(JSON.parse(await run('search', 'Fresh contract', '--json'))).toEqual([]);
		await writeContract(fixture.root, 'broken.json', { id: 'broken' });
		await expect(run('list')).rejects.toThrow(/broken.json/i);
	}
);
