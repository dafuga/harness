import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderCatalogAdapter } from '../../src/adapters/ProviderCatalogAdapter';
import { measureWorkload } from '../support/measureWorkload';

const model = {
	slug: 'native-model',
	display_name: 'Native model',
	visibility: 'list',
	default_reasoning_level: 'high',
	supported_reasoning_levels: [{ effort: 'high' }]
};

test('discovers each provider independently, omits hidden models and leaves missing catalogs empty', async () => {
	const home = await mkdtemp(join(tmpdir(), 'picker-catalog-'));
	const openai = join(home, 'native.json');
	const claude = join(home, 'claude.json');
	try {
		const adapter = new ProviderCatalogAdapter({ openai, claude });
		expect(await adapter.list()).toEqual([]);
		await writeFile(openai, '{');
		expect(await adapter.list()).toEqual([]);
		for (const invalid of [
			{ ...model, slug: '' },
			{ ...model, slug: 'x'.repeat(151) },
			{ ...model, display_name: 'x'.repeat(201) },
			{ ...model, supported_reasoning_levels: [] }
		]) {
			await writeFile(openai, JSON.stringify({ models: [invalid] }));
			expect(await adapter.list()).toEqual([]);
		}
		const boundary = { ...model, slug: 'x'.repeat(150), display_name: 'x'.repeat(200) };
		await writeFile(openai, JSON.stringify({ models: [boundary] }));
		expect(await adapter.list()).toMatchObject([
			{ model: boundary.slug, label: boundary.display_name }
		]);
		await writeFile(
			openai,
			JSON.stringify({ models: [model, { ...model, slug: 'hidden', visibility: 'hide' }] })
		);
		const native = {
			provider: 'openai',
			model: 'native-model',
			label: 'Native model',
			efforts: ['high'],
			defaultEffort: 'high',
			source: 'local-catalog'
		};
		expect(await adapter.list()).toEqual([native]);
		await writeFile(claude, JSON.stringify({ models: [{ ...model, slug: 'claude-opus-5-5' }] }));
		const other = { ...native, provider: 'harness-claude', model: 'claude-opus-5-5' };
		expect(
			await measureWorkload('adapter.provider-catalog', 'two-catalogs', () => adapter.list())
		).toEqual([native, other]);
		await writeFile(openai, '{}');
		expect(await adapter.list()).toEqual([other]);
		await rm(claude);
		expect(await adapter.list()).toEqual([]);
	} finally {
		await rm(home, { recursive: true, force: true });
	}
});
