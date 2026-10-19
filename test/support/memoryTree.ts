import { createHash } from 'node:crypto';
import type { SourceTree } from '../../src/core/sourceTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';
import {
	SourceIndexService,
	type SourceIndex
} from '../../src/services/source-index-service/SourceIndexService';
import {
	UnitIndexService,
	type UnitIndexResult
} from '../../src/services/unit-index-service/UnitIndexService';

export function memoryTree(files: Record<string, string>): SourceTree {
	return {
		revision: 'memory',
		list: () =>
			Promise.resolve(
				Object.entries(files).map(([path, contents]) => ({
					path,
					hash: createHash('sha1').update(contents).digest('hex')
				}))
			),
		read: (path) => Promise.resolve(files[path])
	};
}

export interface Indexed {
	index: SourceIndex;
	result: UnitIndexResult;
}

export async function indexFiles(
	files: Record<string, string>,
	existing: ComponentManifest[] = []
): Promise<Indexed> {
	const index = await new SourceIndexService().index(memoryTree(files), defaultUnitsConfig);
	return { index, result: new UnitIndexService().index(index, existing) };
}

export function unitOf(indexed: Indexed, id: string): ComponentManifest {
	const unit = indexed.result.manifests.find((manifest) => manifest.id === id);
	if (!unit) throw new Error(`Unit ${id} was not indexed.`);
	return unit;
}

export function retire(unit: ComponentManifest): ComponentManifest {
	return { ...unit, status: 'retired', retired: { reason: 'Removed', at: '2026-10-10T00:00:00Z' } };
}
