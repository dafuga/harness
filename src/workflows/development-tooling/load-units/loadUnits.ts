import type { LoadedUnits } from './loadUnits.types';
import { revisionRegistry } from '../../../utils/revisionRegistry';
import { unitMetadata } from '../../../utils/explorer-ui/unitMetadata';
import { helperContract } from '../../../utils/development-tooling/helperContract';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { resolve } from 'node:path';
import { WorkingTreeAdapter } from '../../../adapters/git-source-history/WorkingTreeAdapter';
import type { SourceGraph, SourceTree } from '../../../core/development-tooling/sourceTypes';
import {
	componentManifestSchema,
	type ComponentManifest
} from '../../../core/development-tooling/unitTypes';
import { ScenarioRepository } from '../../../repositories/verification-evidence/ScenarioRepository';
import { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';
import { SourceGraphService } from '../../../services/development-tooling/SourceGraphService';
import { SourceIndexService } from '../../../services/development-tooling/source-index-service/SourceIndexService';
import { UnitIndexService, type UnitIndexResult } from './unit-index-service/UnitIndexService';

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
	const metadataErrors = await committedHelpers(source, fresh, registry.manifests);
	return {
		root: absolute,
		config,
		index,
		stored: registry.manifests,
		scenarios: scenarios.manifests,
		errors: [...registry.errors, ...scenarios.errors, ...metadataErrors],
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
): Promise<string[]> {
	const enriched = revisionRegistry(fresh.manifests, []).units;
	await unitMetadata(tree, enriched);
	for (const unit of fresh.manifests) {
		const helpers =
			enriched.find((item) => item.id === unit.id)?.helpers?.filter(helperContract) ?? [];
		if (helpers.length)
			unit.helperContracts = helpers.map(
				({ name, source, inputs, output, consumers, examples }) => ({
					name,
					source,
					inputs,
					output,
					consumers: consumers ?? [],
					...(examples ? { examples } : {}),
					pure: true
				})
			);
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
	return configControlErrors(enriched);
}

function configControlErrors(units: Parameters<typeof unitMetadata>[1]): string[] {
	return units
		.filter((unit) => unit.status === 'active' && unit.kind === 'config')
		.flatMap((unit) =>
			(unit.configControls ?? [])
				.filter(
					(control) =>
						!unit.configValues?.some(
							(value) => value.source === control.source && value.name === control.name
						)
				)
				.map(
					(control) =>
						`${unit.id}: ${control.name} is not a recorded config value in ${control.source}`
				)
		);
}

export type { LoadedUnits } from './loadUnits.types';
