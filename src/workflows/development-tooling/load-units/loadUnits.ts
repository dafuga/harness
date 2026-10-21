import { revisionRegistry } from '../../../utils/revisionRegistry';
import { unitMetadata } from '../../../utils/explorer-ui/unitMetadata';
import { helperContract } from '../../../utils/development-tooling/helperContract';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { resolve } from 'node:path';
import { WorkingTreeAdapter } from '../../../adapters/git-source-history/WorkingTreeAdapter';
import type { SourceGraph, SourceTree } from '../../../core/development-tooling/sourceTypes';
import {
	componentManifestSchema,
	type ComponentManifest,
	type ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import { ScenarioRepository } from '../../../repositories/verification-evidence/ScenarioRepository';
import { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';
import { SourceGraphService } from '../../../services/development-tooling/SourceGraphService';
import {
	SourceIndexService,
	type SourceIndex
} from '../../../services/development-tooling/source-index-service/SourceIndexService';
import { UnitIndexService, type UnitIndexResult } from './unit-index-service/UnitIndexService';

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
	const fresh = new UnitIndexService().index(index, registry.manifests);
	await committedHelpers(source, fresh, registry.manifests);
	return {
		root: absolute,
		config,
		index,
		stored: registry.manifests,
		scenarios: scenarios.manifests,
		errors: [...registry.errors, ...scenarios.errors],
		unformatted: registry.unformatted,
		fresh,
		repository
	};
}

export function graphOf(loaded: LoadedUnits, manifests = loaded.stored): SourceGraph {
	return new SourceGraphService().build(loaded.index, manifests, loaded.scenarios);
}

async function committedHelpers(
	tree: SourceTree,
	fresh: UnitIndexResult,
	stored: ComponentManifest[]
): Promise<void> {
	const enriched = revisionRegistry(fresh.manifests, []).units;
	await unitMetadata(tree, enriched);
	for (const unit of fresh.manifests) {
		const helpers =
			enriched.find((item) => item.id === unit.id)?.helpers?.filter(helperContract) ?? [];
		if (helpers.length)
			unit.helperContracts = helpers.map(({ name, source, inputs, output, consumers }) => ({
				name,
				source,
				inputs,
				output,
				consumers: consumers ?? [],
				pure: true
			}));
		else delete unit.helperContracts;
	}
	fresh.manifests = fresh.manifests.map((unit) => {
		const checked = componentManifestSchema.safeParse(unit);
		return checked.success ? checked.data : unit;
	});
	const before = new Map(stored.map((unit) => [unit.id, stableJson(unit)]));
	const created = new Set([
		...fresh.added,
		...fresh.revived,
		...fresh.moved.map((move) => move.id)
	]);
	fresh.updated = fresh.manifests
		.filter((unit) => !created.has(unit.id) && before.get(unit.id) !== stableJson(unit))
		.map((unit) => unit.id);
}
