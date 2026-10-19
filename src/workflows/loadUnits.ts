import { resolve } from 'node:path';
import { WorkingTreeAdapter } from '../adapters/WorkingTreeAdapter';
import type { SourceGraph, SourceTree } from '../core/sourceTypes';
import type { ComponentManifest, ScenarioManifest } from '../core/unitTypes';
import type { UnitsConfig } from '../core/unitsConfig';
import { ScenarioRepository } from '../repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../repositories/UnitRegistryRepository';
import { SourceGraphService } from '../services/SourceGraphService';
import { SourceIndexService, type SourceIndex } from "../services/source-index-service/SourceIndexService";
import { UnitIndexService, type UnitIndexResult } from "../services/unit-index-service/UnitIndexService";

export interface LoadedUnits {
	root: string;
	config: UnitsConfig;
	index: SourceIndex;
	/** Manifests exactly as stored. */
	stored: ComponentManifest[];
	scenarios: ScenarioManifest[];
	/** Schema problems found in stored manifests and scenarios. */
	errors: string[];
	/** Units whose stored file is not in canonical form. */
	unformatted: string[];
	/** What the registry should contain for this source tree. */
	fresh: UnitIndexResult;
	repository: UnitRegistryRepository;
}

/** Reads the registry and indexes one source tree; the working tree unless one is supplied. */
export async function loadUnits(
	root = process.cwd(),
	tree?: SourceTree,
	indexer = new SourceIndexService()
): Promise<LoadedUnits> {
	const absolute = resolve(root);
	const source = tree ?? new WorkingTreeAdapter(absolute);
	const repository = new UnitRegistryRepository(absolute);
	const config = await repository.config(source);
	const index = await indexer.index(source, config);
	const registry = await repository.read(source);
	const scenarios = await new ScenarioRepository(absolute).read(source);
	return {
		root: absolute,
		config,
		index,
		stored: registry.manifests,
		scenarios: scenarios.manifests,
		errors: [...registry.errors, ...scenarios.errors],
		unformatted: registry.unformatted,
		fresh: new UnitIndexService().index(index, registry.manifests),
		repository
	};
}

export function graphOf(loaded: LoadedUnits, manifests = loaded.stored): SourceGraph {
	return new SourceGraphService().build(loaded.index, manifests, loaded.scenarios);
}
