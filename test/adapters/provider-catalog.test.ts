import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderCatalogAdapter } from '../../src/adapters/ProviderCatalogAdapter';

test('discovers each provider independently, omits hidden models and leaves missing catalogs empty', async () => {
	const home = await mkdtemp(join(tmpdir(), 'picker-catalog-'));
	const openai = join(home, 'native.json');
	const claude = join(home, 'claude.json');
	const model = {
		slug: 'native-model',
		display_name: 'Native model',
		visibility: 'list',
		default_reasoning_level: 'high',
		supported_reasoning_levels: [{ effort: 'high' }]
	};
	try {
		await writeFile(
			openai,
			JSON.stringify({ models: [model, { ...model, slug: 'hidden', visibility: 'hide' }] })
		);
		const adapter = new ProviderCatalogAdapter({ openai, claude });
		expect(await adapter.list()).toEqual([
			{
				provider: 'openai',
				model: 'native-model',
				label: 'Native model',
				efforts: ['high'],
				defaultEffort: 'high',
				source: 'local-catalog'
			}
		]);
		await writeFile(claude, JSON.stringify({ models: [{ ...model, slug: 'claude-opus-5-5' }] }));
		expect((await adapter.list())[1].provider).toBe('harness-claude');
		await writeFile(openai, '{}');
		expect(await adapter.list()).toHaveLength(1);
	} finally {
		await rm(home, { recursive: true, force: true });
	}
});
