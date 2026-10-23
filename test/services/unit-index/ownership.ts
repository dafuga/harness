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
	const types = {
		...first,
		id: 'model.z-types',
		kind: 'model',
		owns: { source: ['src/utils/z.types.ts'], symbols: ['Z'] }
	};
	const declared = await indexFiles(files, [first, types]);
	expect(unitOf(declared, 'model.z-types').owns.source).toEqual(types.owns.source);
}
