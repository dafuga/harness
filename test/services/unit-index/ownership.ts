import { SourceGraphService } from '../../../src/services/development-tooling/SourceGraphService';
import { measureWorkload } from '../../support/measureWorkload';
import { expect } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { recordIndexWorkload } from './measurements';

export async function assertCompanionOwnership(
	files: Record<string, string>,
	first: ComponentManifest
): Promise<void> {
	const grouped = { ...first, owns: { source: Object.keys(files), symbols: ['z', 'a'] } };
	const once = await indexFiles(files, [grouped]);
	const again = await indexFiles(files, once.result.manifests);
	expect(again.result.updated, 'one-pass source indexing must be idempotent').toEqual([]);
	expect(again.result.manifests).toEqual(once.result.manifests);
	expect([...once.index.files.keys()]).toEqual(Object.keys(files));
	const started = performance.now();
	const automatic = await indexFiles(files);
	recordIndexWorkload(performance.now() - started);
	expect(
		unitOf(automatic, 'function.z').owns.source,
		'a sibling type file belongs to its implementation'
	).toEqual(['src/utils/z.ts', 'src/utils/z.types.ts']);
	expect(automatic.result.added).toEqual(['function.a', 'function.z']);
	const visual = await indexFiles({
		'src/components/Tile.svelte': '<p>Tile</p>',
		'src/components/Tile.types.ts': 'export interface TileProps { title: string }'
	});
	expect(visual.result.added).toEqual(['component.tile']);
	await assertForwardedComponentOwnership(unitOf(visual, 'component.tile'));
	const types = {
		...first,
		id: 'model.z-types',
		kind: 'model',
		owns: { source: ['src/utils/z.types.ts'], symbols: ['Z'] }
	};
	const declared = await indexFiles(files, [first, types]);
	expect(unitOf(declared, 'model.z-types').owns.source).toEqual(types.owns.source);
}

/** A relocated component and its retained forwarding entry describe one public prop contract. */
async function assertForwardedComponentOwnership(original: ComponentManifest): Promise<void> {
	const entry = 'src/components/catalog/Tile.svelte';
	const files = {
		'src/components/Tile.svelte': `<script lang="ts">
			import type { ComponentProps } from 'svelte';
			import Tile from './catalog/Tile.svelte';
			let props: ComponentProps<typeof Tile> = $props();
		</script><Tile {...props} />`,
		[entry]: '<script lang="ts">let { title }: { title: string } = $props();</script><p>{title}</p>'
	};
	for (const origin of ['derived', 'declared'] as const) {
		const owner = {
			...original,
			owns: { ...original.owns, source: Object.keys(files) },
			runtime: { kind: 'module' as const, entry, targets: [{ kind: 'module' as const, entry }] },
			contract: {
				...original.contract,
				origin,
				inputs: [{ name: 'Tile.title', type: 'string', required: true }]
			}
		};
		const indexed = await indexFiles(files, [owner]);
		expect(
			unitOf(indexed, owner.id).contract.inputs,
			'forwarded component props appear once'
		).toEqual([{ name: 'Tile.title', type: 'string', required: true }]);
	}
}

export async function assertContractDependency(): Promise<void> {
	const files = {
		'src/utils/rank.ts': 'export function rank(value: number): number {\n\treturn value;\n}\n',
		'test/rank.test.ts':
			"import type { rank } from '../src/utils/rank';\nimport { rank as runtimeRank } from '../src/utils/rank';\n",
		'src/utils/rankFast.ts':
			'export function rankFast(value: number): number {\n\treturn value;\n}\n'
	};
	const first = await indexFiles(files);
	const link = {
		unit: 'function.rank',
		via: 'contract',
		origin: 'declared',
		contract: 'rank'
	} as const;
	const fast = { ...unitOf(first, 'function.rank-fast'), dependencies: [link] };
	const again = await indexFiles(files, [unitOf(first, 'function.rank'), fast]);

	expect(again.result.updated).toEqual([]);
	expect(unitOf(again, 'function.rank-fast').dependencies).toEqual([link]);
	const graph = await measureWorkload(
		'service.source-graph',
		'build-contract-dependency-graph',
		() => new SourceGraphService().build(again.index, again.result.manifests)
	);
	expect(
		graph.edges
			.filter((edge) => edge.from === 'file:test/rank.test.ts')
			.map((edge) => edge.typeOnly)
	).toEqual([true, false]);
	expect(graph.edges).toEqual(
		expect.arrayContaining([
			{ from: 'unit:function.rank-fast', to: 'unit:function.rank', via: 'contract' },
			{ from: 'file:src/utils/rankFast.ts', to: 'unit:function.rank', via: 'contract' }
		])
	);
}
