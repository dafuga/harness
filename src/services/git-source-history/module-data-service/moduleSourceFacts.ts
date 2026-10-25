import { SourceIndexService } from '../../development-tooling/source-index-service/SourceIndexService';
import { modulePreviewBindings } from './modulePreviewBindings';
import { UnitRegistryRepository } from '../../../repositories/UnitRegistryRepository';
import { ScenarioRepository } from '../../../repositories/ScenarioRepository';
import { previewBinding } from '../../../utils/development-tooling/previewBinding';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { LoadedUnits } from '../../../workflows/development-tooling/load-units/loadUnits';
import { componentVersion } from '../../../utils/development-tooling/componentVersion';
import type { ModuleDataIdentity } from '../../../repositories/git-source-history/ModuleDataRepository.types';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { loadUnits, graphOf } from '../../../workflows/development-tooling/load-units/loadUnits';
import { revisionRegistry } from '../../../utils/revisionRegistry';
import { unitMetadata } from '../../explorer-ui/revision-detail-service/unitMetadata';
import { unitMeasurements } from '../../../utils/development-tooling/unitMeasurements';
import { UnitRegistryValidator } from '../../../validators/development-tooling/UnitRegistryValidator';
import { BudgetLedgerRepository } from '../../../repositories/BudgetLedgerRepository';
import { BudgetService } from '../../budget-service/BudgetService';
import { moduleRelationships } from './moduleRelationships';
export async function moduleSourceFacts(
	root: string,
	identity: ModuleDataIdentity,
	indexer = new SourceIndexService()
) {
	try {
		return await scanModuleSourceFacts(root, identity, indexer);
	} catch (cause) {
		return sourceGaps(root, identity, cause);
	}
}
async function scanModuleSourceFacts(
	root: string,
	identity: ModuleDataIdentity,
	indexer: SourceIndexService
) {
	const tree = await CommitTreeAdapter.open(root, identity.commit),
		loaded = await loadUnits(root, tree, indexer);
	const declarations = loaded.fresh.manifests,
		ledger = await new BudgetLedgerRepository(root).read(tree);
	const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
	const limits = new BudgetService().baselines(ledger.events, declarations);
	const registry = revisionRegistry(declarations, loaded.scenarios, blobs, limits);
	await unitMetadata(tree, registry.units);
	modulePreviewBindings(registry, declarations);
	measureSource(registry, loaded, identity.commit);
	const sourceGraph = graphOf(loaded, declarations);
	return {
		declarations,
		registry,
		versions: Object.fromEntries(
			declarations.map((unit) => [unit.id, componentVersion(unit, loaded.index.files)])
		),
		sourceGraph,
		references: sourceGraph.uncertain,
		relationships: moduleRelationships(registry),
		sourceIssues: [
			...loaded.errors,
			...declarations.flatMap((unit) => previewBinding(unit, loaded.scenarios)),
			...new UnitRegistryValidator().validate(declarations, new Set(loaded.index.files.keys()))
		]
	};
}

function measureSource(registry: RevisionRegistry, loaded: LoadedUnits, commit: string) {
	const manifests = new Map(loaded.fresh.manifests.map((unit) => [unit.id, unit]));
	for (const unit of registry.units) {
		if (unit.status !== 'active') continue;
		const observations = unitMeasurements(manifests.get(unit.id)!, loaded.index.files, commit);
		const missing = unit.owns.source.filter((path) => !loaded.index.files.has(path));
		unit.sourceMeasurements = missing.length
			? observations.map((item) => ({
					...item,
					value: null,
					unavailable: `Missing owned source: ${missing.join(', ')}`
				}))
			: observations;
	}
}

async function sourceGaps(root: string, identity: ModuleDataIdentity, cause: unknown) {
	const tree = await CommitTreeAdapter.open(root, identity.commit);
	const [units, scenarios] = await Promise.all([
		new UnitRegistryRepository(root).read(tree),
		new ScenarioRepository(root).read(tree)
	]);
	const entries = await tree.list(),
		blobs = new Map(entries.map((entry) => [entry.path, entry.hash]));
	const registry = revisionRegistry(units.manifests, scenarios.manifests, blobs);
	const gap = `Source indexing failed: ${cause instanceof Error ? cause.message : String(cause)}`;
	registry.available = false;
	registry.gap = gap;
	const files = new Map(entries.map((entry) => [entry.path, { hash: entry.hash }]));
	return {
		declarations: units.manifests,
		registry,
		versions: Object.fromEntries(
			units.manifests.map((unit) => [unit.id, componentVersion(unit, files)])
		),
		sourceGraph: { nodes: [], edges: [], uncertain: [] },
		references: [],
		relationships: moduleRelationships(registry),
		sourceIssues: [gap, ...units.errors, ...scenarios.errors]
	};
}
